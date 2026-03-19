import{cR as e,cS as t,cT as o,cU as n,cV as r}from"./index-D9IhqqAc.js";import"./html5-qrcode-D_4nuB1t.js";
/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const startStatusTap=()=>{const s=window;s.addEventListener("statusTap",()=>{e(()=>{const e=s.innerWidth,i=s.innerHeight,c=document.elementFromPoint(e/2,i/2);if(!c)return;const a=t(c);a&&new Promise(e=>o(a,e)).then(()=>{n(async()=>{a.style.setProperty("--overflow","hidden"),await r(a,300),a.style.removeProperty("--overflow")})})})})};export{startStatusTap};
