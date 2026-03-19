System.register(["./index-legacy-DryGZUwD.js","./html5-qrcode-legacy-D5DtuMLO.js"],function(e,t){"use strict";var n,r,s,o,c;return{setters:[e=>{n=e.cR,r=e.cS,s=e.cT,o=e.cU,c=e.cV},null],execute:function(){
/*!
             * (C) Ionic http://ionicframework.com - MIT License
             */
e("startStatusTap",()=>{const e=window;e.addEventListener("statusTap",()=>{n(()=>{const t=e.innerWidth,n=e.innerHeight,i=document.elementFromPoint(t/2,n/2);if(!i)return;const a=r(i);a&&new Promise(e=>s(a,e)).then(()=>{o(async()=>{a.style.setProperty("--overflow","hidden"),await c(a,300),a.style.removeProperty("--overflow")})})})})})}}});
