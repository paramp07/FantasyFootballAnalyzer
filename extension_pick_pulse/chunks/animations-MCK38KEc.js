import{t as e}from"./utils-CklTXkDM-DwXCFYxT.js";import{c as t,d as n,s as r}from"./InternalThemeProvider-Cmgc53_n.js";import{n as i}from"./emotion-react.browser.esm-CkYOwb9I.js";var a=Object.freeze({xs:`21em`,sm:`30em`,md:`48em`,lg:`62em`,xl:`80em`,"2xl":`96em`}),o={ios:`@supports (-webkit-touch-callout: none)`,...n(Object.entries(a).map(([e,t])=>[e,`@media (max-width: ${t})`]))},s=()=>{let e=new Proxy({},{get:(t,n)=>n===Symbol.toPrimitive?()=>``:n in Object.getPrototypeOf(``)?e=>Object.getPrototypeOf(``)[n].call(``,e):n===Symbol.toPrimitive?()=>``:e});return e},c=e=>{let t=(t={})=>n=>{let{base:r,variants:i={},compoundVariants:a=[],defaultVariants:o={}}=e(n,t),s=m(i,t,o),c={};return u(c,r),d(c,s,i),f(c,s,a),p(c),c},n=s(),r=Object.keys(e(n,n).variants||{});return{applyVariants:t,filterProps:e=>l(e,r)}},l=(e,t)=>{let n={...e};for(let e of t)delete n[e];return n},u=(e,t)=>{t&&typeof t==`object`&&Object.assign(e,t)},d=(t,n,r)=>{for(let i in n)e(r[i][n[i]],t)},f=(t,n,r)=>{for(let i of r)h(i,n)&&e(i.styles,t)},p=e=>{for(let t in e)t.startsWith(`var(`)&&(e[t.slice(4,-1)]=e[t],delete e[t])},m=(e,t,n)=>{let r={};for(let i in e)i in t?r[i]=t[i]:i in n&&(r[i]=n[i]);return r},h=({condition:e},t)=>{for(let n in e)if(e[n]!==t[n])return!1;return!0},g=e=>{let t={fontFamily:`inherit`,letterSpacing:e.letterSpacings.$normal};return{h1:{...t,fontWeight:e.fontWeights.$semibold,fontSize:e.fontSizes.$xl,lineHeight:e.lineHeights.$extraSmall},h2:{...t,fontWeight:e.fontWeights.$bold,fontSize:e.fontSizes.$lg,lineHeight:e.lineHeights.$medium},h3:{...t,fontWeight:e.fontWeights.$bold,fontSize:e.fontSizes.$md,lineHeight:e.lineHeights.$small},subtitle:{...t,fontWeight:e.fontWeights.$medium,fontSize:e.fontSizes.$md,lineHeight:e.lineHeights.$small},body:{...t,fontWeight:e.fontWeights.$normal,fontSize:e.fontSizes.$md,lineHeight:e.lineHeights.$small},caption:{...t,fontWeight:e.fontWeights.$medium,fontSize:e.fontSizes.$xs,lineHeight:e.lineHeights.$large},buttonLarge:{...t,fontWeight:e.fontWeights.$medium,fontSize:e.fontSizes.$md,lineHeight:e.lineHeights.$small,fontFamily:e.fonts.$buttons},buttonSmall:{...t,fontWeight:e.fontWeights.$medium,fontSize:e.fontSizes.$sm,lineHeight:e.lineHeights.$extraSmall,fontFamily:e.fonts.$buttons}}},_=(e,t)=>{let n=t?.hasError?e.colors.$dangerAlpha500:e.colors.$borderAlpha300,r=e.shadows.$input.replace(`{{color}}`,t?.hasError?e.colors.$dangerAlpha200:e.colors.$borderAlpha150),i=t?.hoverStyles===!1?{}:{"&:hover":{WebkitTapHighlightColor:`transparent`,borderColor:n,boxShadow:r}},a=t?.hasError?e.colors.$dangerAlpha500:t?.hasWarning?e.colors.$warningAlpha300:e.colors.$borderAlpha150,o=t?.hasError?e.colors.$borderAlpha150:t?.hasWarning?e.colors.$warningAlpha50:e.colors.$borderAlpha100,s=e.shadows.$input.replace(`{{color}}`,o),c={borderColor:n,WebkitTapHighlightColor:`transparent`,boxShadow:[r,e.shadows.$focusRing.replace(`{{color}}`,t?.hasError?e.colors.$dangerAlpha200:e.colors.$borderAlpha150)].toString()},l=t?.focusRing===!1?{}:{"&:focus":c,"&:focus:not(:focus-visible)":{borderColor:a,boxShadow:s},"&:focus-visible":c};return{normal:{borderRadius:e.radii.$md,borderWidth:e.borderWidths.$normal,borderStyle:e.borderStyles.$solid,borderColor:a,boxShadow:s,transitionProperty:e.transitionProperty.$common,transitionTimingFunction:e.transitionTiming.$common,transitionDuration:e.transitionDuration.$focusRing,...i,...l}}},v=(e,t)=>({borderColor:t?.hasError?e.colors.$dangerAlpha500:e.colors.$borderAlpha150}),y=e=>({"&::-moz-focus-inner":{border:`0`},WebkitTapHighlightColor:`transparent`,boxShadow:e.shadows.$focusRing.replace(`{{color}}`,e.colors.$colorRing),transitionProperty:e.transitionProperty.$common,transitionTimingFunction:e.transitionTiming.$common,transitionDuration:e.transitionDuration.$focusRing}),b=e=>({"&:focus":{...y(e)},"&:focus:not(:focus-visible)":{boxShadow:`none`},"&:focus-visible":{...y(e)}}),x=e=>({"&:disabled,&[data-disabled]":{cursor:`not-allowed`,pointerEvents:`none`,opacity:e.opacity.$disabled}}),S=(e=`flex`)=>({display:e,justifyContent:`center`,alignItems:`center`}),C=e=>{let t={"::-webkit-scrollbar":{background:e.colors.$neutralAlpha50,width:`6px`,height:`6px`},"::-webkit-scrollbar-thumb":{background:e.colors.$neutralAlpha600,borderRadius:e.radii.$sm,transition:`background-color ${e.transitionDuration.$fast} ${e.transitionTiming.$common}`},"::-webkit-scrollbar-thumb:hover":{background:e.colors.$neutralAlpha700},"::-webkit-scrollbar-track":{background:e.colors.$neutralAlpha50}};return t[`@supports not selector(::-webkit-scrollbar)`]={scrollbarColor:`${e.colors.$neutralAlpha600} ${e.colors.$neutralAlpha50}`,scrollbarWidth:`thin`},t},w=e=>({height:`100%`,overflowY:`auto`,...C(e)}),T=(e,t)=>`linear-gradient(${t},${t}), linear-gradient(${e}, ${e})`,E={textVariants:g,borderVariants:_,focusRingStyles:y,focusRing:b,disabled:x,borderColor:v,centeredFlex:S,maxHeightScroller:w,mutedBackground:e=>t(`color-muted`,e.colors.$colorMuted||T(r.setAlpha(e.colors.$colorBackground,1),e.colors.$neutralAlpha50)),unstyledScrollbar:C,mergedColorsBackground:T,visuallyHidden:()=>({clip:`rect(0 0 0 0)`,clipPath:`inset(50%)`,height:`1px`,overflow:`hidden`,position:`absolute`,whiteSpace:`nowrap`,width:`1px`})},D=(...e)=>n(e.map(e=>[e,`var(--${e})`])),O=i`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }`,k=i`
  0% {
    opacity: 0;
    transform: scaleY(1) translateY(-6px);
  }
  100% {
    opacity: 1;
    transform: scaleY(1)  translateY(0px);
  }
`,A=i`
  0% {
    opacity: 0;
    transform: translateY(0.5rem);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`,j=i`
  0% { opacity: 0; }
  100% { opacity: 1; }
`,M=i`
  0% { opacity: 1; }
  100% { opacity: 0; }
`,N=i`
  0% {
    opacity: 0;
    transform: translateY(-5px);
    max-height: 0;
  }
  100% {
    opacity: 1;
    transform: translateY(0px);
    max-height: 6rem;
  }
`,P=i`
  0% {
    opacity: 0;
    transform: translateY(-5px);
    max-height: 0;
  }
  50% {
    opacity: 0;
    transform: translateY(-5px);
    max-height: 0;
  }
  100% {
    opacity: 1;
    transform: translateY(0px);
    max-height: 6rem;
  }
`,F=i`
  0% {
    opacity: 0;
    transform: translateY(5px) scale(.5);
  }

  50% {
    opacity: 1;
    transform: translateY(0px) scale(1.2);
  }

  100% {
    opacity: 1;
    transform: translateY(0px) scale(1);
  }
`,I=i`
  0% {
    opacity:1;
    transform: translateY(0px);
    max-height: 6rem;
    visibility: visible;
  }
  100% {
    opacity: 0;
    transform: translateY(5px);
    max-height: 0;
    visibility: visible;
  }
`,L={spinning:O,dropdownSlideInScaleAndFade:k,modalSlideAndFade:A,fadeIn:j,fadeOut:M,textInSmall:i`
  0% {opacity: 0;max-height: 0;}
  100% {opacity: 1;max-height: 3rem;}
`,textInBig:i`
  0% {opacity: 0;max-height: 0;}
  100% {opacity: 1;max-height: 8rem;}
`,blockBigIn:i`
  0% {opacity: 0;max-height: 0;}
  99% {opacity: 1;max-height: 10rem;}
  100% {opacity: 1;max-height: unset;}
`,expandIn:e=>i`
  0% {opacity: 0;max-height: 0;}
  99% {opacity: 1;max-height: ${e};}
  100% {opacity: 1;max-height: unset;}
`,navbarSlideIn:i`
  0% {opacity: 0; transform: translateX(-100%);}
  100% {opacity: 1; transform: translateX(0);}
`,inAnimation:N,inDelayAnimation:P,outAnimation:I,notificationAnimation:F};export{o as a,c as i,D as n,E as r,L as t};