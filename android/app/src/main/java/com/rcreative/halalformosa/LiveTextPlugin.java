package com.rcreative.halalformosa;

import android.Manifest;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.media.Image;
import android.util.Base64;
import android.util.Log;
import android.util.Size;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.core.resolutionselector.AspectRatioStrategy;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Live text recognition for the "Live Verdict" experiment.
 *
 * Shows the camera in a PreviewView placed behind the (transparent) webview and runs
 * ML Kit text recognition on every analysed frame. Frames stay in memory and are closed
 * as soon as recognition finishes; only the recognised text and its boxes are sent to
 * JavaScript, in the coordinate space of the upright analysis image.
 *
 * The Chinese recogniser also reads Latin script, so one model covers both.
 */
@CapacitorPlugin(
    name = "LiveText",
    permissions = { @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera") }
)
public class LiveTextPlugin extends Plugin {

    private static final String TAG = "LiveText";

    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private Camera camera;
    private ImageCapture imageCapture;
    private TextRecognizer recognizer;
    private ExecutorService analysisExecutor;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("Camera permission not granted");
            return;
        }
        getActivity().runOnUiThread(() -> startCamera(call));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            teardown();
            call.resolve();
        });
    }

    @PluginMethod
    public void setTorch(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            if (camera == null || !camera.getCameraInfo().hasFlashUnit()) {
                call.reject("Torch unavailable");
                return;
            }
            camera.getCameraControl().enableTorch(enabled);
            call.resolve();
        });
    }

    /**
     * One still photo for the "add this product" flow. Kept in memory only: the JPEG is decoded,
     * rotated upright and handed to JavaScript as base64; nothing is written to storage.
     */
    @PluginMethod
    public void takePhoto(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (previewView == null) {
                call.reject("Camera is not running");
                return;
            }
            if (imageCapture == null) {
                // Some devices cannot run preview + analysis + capture together; use the preview frame.
                Bitmap preview = previewView.getBitmap();
                if (preview == null) {
                    call.reject("Camera is not ready");
                    return;
                }
                resolvePhoto(call, preview);
                return;
            }
            imageCapture.takePicture(
                analysisExecutor,
                new ImageCapture.OnImageCapturedCallback() {
                    @Override
                    public void onCaptureSuccess(@NonNull ImageProxy image) {
                        try {
                            ByteBuffer buffer = image.getPlanes()[0].getBuffer();
                            byte[] bytes = new byte[buffer.remaining()];
                            buffer.get(bytes);
                            Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                            if (decoded == null) {
                                call.reject("Could not read the photo");
                                return;
                            }
                            int rotation = image.getImageInfo().getRotationDegrees();
                            if (rotation != 0) {
                                Matrix matrix = new Matrix();
                                matrix.postRotate(rotation);
                                decoded = Bitmap.createBitmap(decoded, 0, 0, decoded.getWidth(), decoded.getHeight(), matrix, true);
                            }
                            resolvePhoto(call, decoded);
                        } catch (Exception e) {
                            Log.e(TAG, "Photo failed", e);
                            call.reject("Could not take the photo: " + e.getMessage());
                        } finally {
                            image.close();
                        }
                    }

                    @Override
                    public void onError(@NonNull ImageCaptureException exception) {
                        Log.e(TAG, "Capture failed", exception);
                        call.reject("Could not take the photo: " + exception.getMessage());
                    }
                }
            );
        });
    }

    private void resolvePhoto(PluginCall call, Bitmap bitmap) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out);
        JSObject result = new JSObject();
        result.put("base64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
        result.put("width", bitmap.getWidth());
        result.put("height", bitmap.getHeight());
        call.resolve(result);
    }

    private void startCamera(PluginCall call) {
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(getContext());
        future.addListener(
            () -> {
                try {
                    cameraProvider = future.get();
                    bindUseCases();
                    call.resolve();
                } catch (Exception e) {
                    Log.e(TAG, "Could not start camera", e);
                    teardown();
                    call.reject("Could not start camera: " + e.getMessage());
                }
            },
            ContextCompat.getMainExecutor(getContext())
        );
    }

    private void bindUseCases() {
        teardown();

        if (recognizer == null) {
            recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
        }
        if (analysisExecutor == null) {
            analysisExecutor = Executors.newSingleThreadExecutor();
        }

        View webView = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) webView.getParent();

        previewView = new PreviewView(getContext());
        // TextureView-backed so it composes correctly underneath the transparent webview.
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        ViewGroup.LayoutParams webViewParams = webView.getLayoutParams();
        ViewGroup.MarginLayoutParams previewParams = webViewParams instanceof ViewGroup.MarginLayoutParams
            ? new ViewGroup.MarginLayoutParams((ViewGroup.MarginLayoutParams) webViewParams)
            : new ViewGroup.MarginLayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            );
        parent.addView(previewView, 0, previewParams);
        webView.setBackgroundColor(Color.TRANSPARENT);

        // Preview and analysis must share one aspect ratio so the boxes line up with what is shown.
        AspectRatioStrategy ratio = AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY;
        Preview preview = new Preview.Builder()
            .setResolutionSelector(new ResolutionSelector.Builder().setAspectRatioStrategy(ratio).build())
            .build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        ImageAnalysis analysis = new ImageAnalysis.Builder()
            .setResolutionSelector(
                new ResolutionSelector.Builder()
                    .setAspectRatioStrategy(ratio)
                    .setResolutionStrategy(
                        new ResolutionStrategy(
                            new Size(1280, 720),
                            ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER
                        )
                    )
                    .build()
            )
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build();
        analysis.setAnalyzer(analysisExecutor, this::analyze);

        ImageCapture capture = new ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .setResolutionSelector(
                new ResolutionSelector.Builder()
                    .setAspectRatioStrategy(ratio)
                    .setResolutionStrategy(
                        new ResolutionStrategy(
                            new Size(1920, 1080),
                            ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER
                        )
                    )
                    .build()
            )
            .build();

        cameraProvider.unbindAll();
        try {
            camera = cameraProvider.bindToLifecycle(
                (LifecycleOwner) getActivity(),
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                analysis,
                capture
            );
            imageCapture = capture;
        } catch (IllegalArgumentException unsupportedCombination) {
            Log.w(TAG, "Preview + analysis + capture not supported here; photos will use the preview frame");
            cameraProvider.unbindAll();
            camera = cameraProvider.bindToLifecycle(
                (LifecycleOwner) getActivity(),
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                analysis
            );
            imageCapture = null;
        }
    }

    @ExperimentalGetImage
    private void analyze(@NonNull ImageProxy proxy) {
        Image media = proxy.getImage();
        if (media == null || recognizer == null) {
            proxy.close();
            return;
        }

        int rotation = proxy.getImageInfo().getRotationDegrees();
        boolean swap = rotation % 180 != 0;
        int width = swap ? proxy.getHeight() : proxy.getWidth();
        int height = swap ? proxy.getWidth() : proxy.getHeight();

        recognizer
            .process(InputImage.fromMediaImage(media, rotation))
            .addOnSuccessListener(text -> notifyListeners("textFrame", toJs(text, width, height)))
            .addOnFailureListener(e -> Log.w(TAG, "Recognition failed", e))
            // The frame is released here and nowhere else, whether or not recognition worked.
            .addOnCompleteListener(task -> proxy.close());
    }

    private static JSObject toJs(Text text, int width, int height) {
        JSArray blocks = new JSArray();
        for (Text.TextBlock block : text.getTextBlocks()) {
            JSArray lines = new JSArray();
            for (Text.Line line : block.getLines()) {
                JSArray elements = new JSArray();
                for (Text.Element element : line.getElements()) {
                    JSObject el = new JSObject();
                    el.put("text", element.getText());
                    el.put("box", boxToJs(element.getBoundingBox()));
                    elements.put(el);
                }
                JSObject l = new JSObject();
                l.put("text", line.getText());
                l.put("box", boxToJs(line.getBoundingBox()));
                l.put("elements", elements);
                lines.put(l);
            }
            JSObject b = new JSObject();
            b.put("lines", lines);
            blocks.put(b);
        }
        JSObject frame = new JSObject();
        frame.put("width", width);
        frame.put("height", height);
        frame.put("blocks", blocks);
        return frame;
    }

    private static JSObject boxToJs(Rect rect) {
        JSObject box = new JSObject();
        if (rect == null) {
            box.put("x", 0).put("y", 0).put("width", 0).put("height", 0);
            return box;
        }
        box.put("x", rect.left).put("y", rect.top).put("width", rect.width()).put("height", rect.height());
        return box;
    }

    private void teardown() {
        if (cameraProvider != null) {
            cameraProvider.unbindAll();
        }
        camera = null;
        imageCapture = null;
        if (previewView != null) {
            ViewGroup parent = (ViewGroup) previewView.getParent();
            if (parent != null) {
                parent.removeView(previewView);
            }
            previewView = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        teardown();
        if (recognizer != null) {
            recognizer.close();
            recognizer = null;
        }
        if (analysisExecutor != null) {
            analysisExecutor.shutdown();
            analysisExecutor = null;
        }
        super.handleOnDestroy();
    }
}
