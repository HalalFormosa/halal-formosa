import{cM as t,cN as e,cO as n}from"./index-D9IhqqAc.js";import"./html5-qrcode-D_4nuB1t.js";
/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const createSwipeBackGesture=(o,r,s,i,c)=>{const a=o.ownerDocument.defaultView;let d=t(o);const getDeltaX=t=>d?-t.deltaX:t.deltaX;return e({el:o,gestureName:"goback-swipe",gesturePriority:101,threshold:10,canStart:e=>(d=t(o),(t=>{const{startX:e}=t;return d?e>=a.innerWidth-50:e<=50})(e)&&r()),onStart:s,onMove:t=>{const e=getDeltaX(t)/a.innerWidth;i(e)},onEnd:t=>{const e=getDeltaX(t),o=a.innerWidth,r=e/o,s=(t=>d?-t.velocityX:t.velocityX)(t),i=s>=0&&(s>.2||e>o/2),l=(i?1-r:r)*o;let h=0;if(l>5){const t=l/Math.abs(s);h=Math.min(t,540)}c(i,r<=0?.01:n(0,r,.9999),h)}})};export{createSwipeBackGesture};
