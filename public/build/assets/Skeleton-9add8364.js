import{T as v,U as b,bi as c,bj as u,$ as C,a3 as k,r as w,a1 as S,b as $,a4 as x,_ as R}from"./app-dd52ea39.js";function U(t){return String(t).match(/[\d.\-+]*\s*(.*)/)[1]||""}function M(t){return parseFloat(t)}function A(t){return v("MuiSkeleton",t)}b("MuiSkeleton",["root","text","rectangular","rounded","circular","pulse","wave","withChildren","fitContent","heightAuto"]);const X=t=>{const{classes:e,variant:a,animation:n,hasChildren:s,width:i,height:o}=t;return R({root:["root",a,n,s&&"withChildren",s&&!i&&"fitContent",s&&!o&&"heightAuto"]},A,e)},r=c`
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }

  100% {
    opacity: 1;
  }
`,l=c`
  0% {
    transform: translateX(-100%);
  }

  50% {
    /* +0.5s of delay between each loop */
    transform: translateX(100%);
  }

  100% {
    transform: translateX(100%);
  }
`,T=typeof r!="string"?u`
        animation: ${r} 2s ease-in-out 0.5s infinite;
      `:null,j=typeof l!="string"?u`
        &::after {
          animation: ${l} 2s linear 0.5s infinite;
        }
      `:null,B=C("span",{name:"MuiSkeleton",slot:"Root",overridesResolver:(t,e)=>{const{ownerState:a}=t;return[e.root,e[a.variant],a.animation!==!1&&e[a.animation],a.hasChildren&&e.withChildren,a.hasChildren&&!a.width&&e.fitContent,a.hasChildren&&!a.height&&e.heightAuto]}})(k(({theme:t})=>{const e=U(t.shape.borderRadius)||"px",a=M(t.shape.borderRadius);return{display:"block",backgroundColor:t.vars?t.vars.palette.Skeleton.bg:t.alpha(t.palette.text.primary,t.palette.mode==="light"?.11:.13),height:"1.2em",variants:[{props:{variant:"text"},style:{marginTop:0,marginBottom:0,height:"auto",transformOrigin:"0 55%",transform:"scale(1, 0.60)",borderRadius:`${a}${e}/${Math.round(a/.6*10)/10}${e}`,"&:empty:before":{content:'"\\00a0"'}}},{props:{variant:"circular"},style:{borderRadius:"50%"}},{props:{variant:"rounded"},style:{borderRadius:(t.vars||t).shape.borderRadius}},{props:({ownerState:n})=>n.hasChildren,style:{"& > *":{visibility:"hidden"}}},{props:({ownerState:n})=>n.hasChildren&&!n.width,style:{maxWidth:"fit-content"}},{props:({ownerState:n})=>n.hasChildren&&!n.height,style:{height:"auto"}},{props:{animation:"pulse"},style:T||{animation:`${r} 2s ease-in-out 0.5s infinite`}},{props:{animation:"wave"},style:{position:"relative",overflow:"hidden",WebkitMaskImage:"-webkit-radial-gradient(white, black)","&::after":{background:`linear-gradient(
                90deg,
                transparent,
                ${(t.vars||t).palette.action.hover},
                transparent
              )`,content:'""',position:"absolute",transform:"translateX(-100%)",bottom:0,left:0,right:0,top:0}}},{props:{animation:"wave"},style:j||{"&::after":{animation:`${l} 2s linear 0.5s infinite`}}}]}})),K=w.forwardRef(function(e,a){const n=S({props:e,name:"MuiSkeleton"}),{animation:s="pulse",className:i,component:o="span",height:p,style:f,variant:m="text",width:g,...d}=n,h={...n,animation:s,component:o,variant:m,hasChildren:!!d.children},y=X(h);return $(B,{as:o,ref:a,className:x(y.root,i),ownerState:h,...d,style:{width:g,height:p,...f}})}),W=K;export{W as S};
