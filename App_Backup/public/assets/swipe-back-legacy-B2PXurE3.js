System.register(["./index-legacy-DryGZUwD.js","./html5-qrcode-legacy-D5DtuMLO.js"],function(t,e){"use strict";var n,r,c;return{setters:[t=>{n=t.cM,r=t.cN,c=t.cO},null],execute:function(){
/*!
             * (C) Ionic http://ionicframework.com - MIT License
             */
t("createSwipeBackGesture",(t,e,s,i,o)=>{const a=t.ownerDocument.defaultView;let l=n(t);const getDeltaX=t=>l?-t.deltaX:t.deltaX;return r({el:t,gestureName:"goback-swipe",gesturePriority:101,threshold:10,canStart:r=>(l=n(t),(t=>{const{startX:e}=t;return l?e>=a.innerWidth-50:e<=50})(r)&&e()),onStart:s,onMove:t=>{const e=getDeltaX(t)/a.innerWidth;i(e)},onEnd:t=>{const e=getDeltaX(t),n=a.innerWidth,r=e/n,s=(t=>l?-t.velocityX:t.velocityX)(t),i=s>=0&&(s>.2||e>n/2),u=(i?1-r:r)*n;let d=0;if(u>5){const t=u/Math.abs(s);d=Math.min(t,540)}o(i,r<=0?.01:c(0,r,.9999),d)}})})}}});
