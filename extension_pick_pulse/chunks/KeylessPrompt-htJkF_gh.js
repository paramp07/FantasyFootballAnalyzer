import{o as e,t}from"./react-CZmEMrhH.js";import{D as n,E as r,G as i,T as a,ht as o}from"./sidepanel-34yG2Zf6.js";import{n as s}from"./EnvironmentContext-DGY7iXhi.js";import{t as c}from"./InternalThemeProvider-Cmgc53_n.js";import{t as l}from"./emotion-react.browser.esm-CkYOwb9I.js";import{t as u}from"./inert-B4HR58j5.js";import{a as d}from"./shared-CLeKjowe.js";var f=e(t(),1),p=`clerk-keyless-prompt-corner`,m=`1.25rem`,h=20,g=5,_=10,v=.999,y=`transform 350ms cubic-bezier(0.34, 1.2, 0.64, 1)`,b=`translate3d(0px, 0px, 0)`,x={x:0,y:0};function S(e,t){let n=`bottom-right`,r=1/0;for(let[i,a]of Object.entries(t)){let t=e.x-a.x,o=e.y-a.y,s=Math.sqrt(t*t+o*o);s<r&&(r=s,n=i)}return n}function C(e){switch(e){case`top-left`:return{top:m,left:m};case`top-right`:return{top:m,right:m};case`bottom-left`:return{bottom:m,left:m};case`bottom-right`:return{bottom:m,right:m}}}var w=[`top-left`,`top-right`,`bottom-left`,`bottom-right`];function T(e){if(!(typeof window>`u`))try{localStorage.setItem(p,e)}catch{}}function E(e){return e/1e3*v/(1-v)}function D(e){if(e.length<2)return x;let t=e[0],n=e[e.length-1],r=n.timestamp-t.timestamp;return r===0?x:{x:(n.position.x-t.position.x)/r*1e3,y:(n.position.y-t.position.y)/r*1e3}}function O(){let[e,t]=(0,f.useState)(`bottom-right`),[n,r]=(0,f.useState)(!1),[i,a]=(0,f.useState)(!1),[o,s]=(0,f.useState)(!1),c=(0,f.useRef)(null);(0,f.useEffect)(()=>{if(typeof window>`u`){s(!0);return}try{let e=localStorage.getItem(p);e&&w.includes(e)&&t(e)}catch{}finally{s(!0)}},[]);let l=(0,f.useRef)(null),u=(0,f.useRef)({state:`idle`}),d=(0,f.useRef)(null),m=(0,f.useRef)({x:0,y:0}),v=(0,f.useRef)({x:0,y:0}),O=(0,f.useRef)(0),k=(0,f.useRef)([]),A=(0,f.useRef)(null),j=(0,f.useCallback)(e=>{l.current&&(v.current=e,l.current.style.transform=`translate3d(${e.x}px, ${e.y}px, 0)`)},[]),M=(0,f.useCallback)(()=>{let t=l.current;if(!t)return{"top-left":x,"top-right":x,"bottom-left":x,"bottom-right":x};let n=A.current?.width??t.offsetWidth??0,r=A.current?.height??t.offsetHeight??0,i=window.innerWidth-document.documentElement.clientWidth;function a(e){let t=e.includes(`right`),a=e.includes(`bottom`);return{x:t?window.innerWidth-i-h-n:h,y:a?window.innerHeight-h-r:h}}let o=a(e);function s(e){let t=a(e);return{x:t.x-o.x,y:t.y-o.y}}return{"top-left":s(`top-left`),"top-right":s(`top-right`),"bottom-left":s(`bottom-left`),"bottom-right":s(`bottom-right`)}},[e]),N=(0,f.useCallback)(n=>{let r=l.current;if(!r)return;let i=n.translation.x-v.current.x,o=n.translation.y-v.current.y;if(Math.sqrt(i*i+o*o)<.5){T(n.corner),v.current=x,r.style.transition=``,r.style.transform=b,u.current={state:`idle`},a(!1);return}let s=i=>{i.propertyName===`transform`&&(r.removeEventListener(`transitionend`,s),T(n.corner),n.corner===e?(v.current=x,r.style.transition=``,r.style.transform=b,u.current={state:`idle`},a(!1)):(u.current={state:`animating`},c.current=n.corner,t(n.corner)))};r.style.transition=y,r.addEventListener(`transitionend`,s),j(n.translation)},[j,e]),P=(0,f.useCallback)(()=>{u.current.state===`drag`?(l.current?.releasePointerCapture(u.current.pointerId),u.current={state:`animating`}):u.current={state:`idle`},d.current&&=(d.current(),null),k.current=[],r(!1),A.current=null,l.current?.classList.remove(`dev-tools-grabbing`),document.body.style.removeProperty(`user-select`),document.body.style.removeProperty(`-webkit-user-select`)},[]);(0,f.useLayoutEffect)(()=>{if(c.current===e){let e=l.current;e&&u.current.state===`animating`&&(v.current=x,e.style.transition=``,e.style.transform=b,u.current={state:`idle`},a(!1),c.current=null)}},[e]),(0,f.useLayoutEffect)(()=>()=>{P()},[P]);let F=(0,f.useCallback)(e=>{let t=e.target;if(t.tagName===`A`||t.closest(`a`)||e.button!==0)return;let n=l.current;if(!n)return;A.current={width:n.offsetWidth,height:n.offsetHeight},m.current={x:e.clientX,y:e.clientY};let i=n.style.transform;if(i&&i!==`none`&&i!==b){let e=i.match(/translate3d\(([^,]+)px,\s*([^,]+)px/);e&&(v.current={x:parseFloat(e[1])||0,y:parseFloat(e[2])||0})}else v.current=x;u.current={state:`press`},k.current=[],O.current=Date.now();let o=e=>{if(u.current.state===`press`){let t=e.clientX-m.current.x,i=e.clientY-m.current.y;if(Math.sqrt(t*t+i*i)<g)return;u.current={state:`drag`,pointerId:e.pointerId};try{n.setPointerCapture(e.pointerId)}catch{}n.style.transition=`none`,n.classList.add(`dev-tools-grabbing`),document.body.style.userSelect=`none`,document.body.style.webkitUserSelect=`none`,r(!0),j({x:v.current.x+t,y:v.current.y+i}),m.current={x:e.clientX,y:e.clientY};return}if(u.current.state!==`drag`)return;let t={x:e.clientX,y:e.clientY},i=t.x-m.current.x,a=t.y-m.current.y;m.current=t,j({x:v.current.x+i,y:v.current.y+a});let o=Date.now();o-O.current>=_&&(k.current=[...k.current.slice(-4),{position:t,timestamp:o}],O.current=o)},s=()=>{if(u.current.state===`drag`){let e=D(k.current),t=M();if(P(),!l.current)return;let n=S({x:v.current.x+E(e.x),y:v.current.y+E(e.y)},t),r=t[n];a(!0),N({corner:n,translation:r})}else P()},c=e=>{let t=e.target,n=t.tagName===`BUTTON`||t.closest(`button`),r=t.tagName===`A`||t.closest(`a`);u.current.state===`animating`&&!n&&!r&&(e.preventDefault(),e.stopPropagation())};window.addEventListener(`pointermove`,o),window.addEventListener(`pointerup`,s,{once:!0}),window.addEventListener(`pointercancel`,P,{once:!0}),n.addEventListener(`click`,c),d.current&&d.current(),d.current=()=>{window.removeEventListener(`pointermove`,o),window.removeEventListener(`pointerup`,s),window.removeEventListener(`pointercancel`,P),n.removeEventListener(`click`,c)}},[P,j,N,M]);return{corner:e,isDragging:n,cornerStyle:C(e),containerRef:l,onPointerDown:F,preventClick:i,isInitialized:o}}var k=10*1e3;function A(){let e=i(),t=(0,f.useRef)(Date.now()),[,n]=(0,f.useReducer)(e=>e+1,0);return(0,f.useEffect)(()=>{let r=new AbortController;return window.addEventListener(`focus`,async()=>{let i=e.__internal_environment;if(i){if(i.authConfig.claimedAt!==null)return r.abort();if(!(Date.now()<t.current+k||document.visibilityState!==`visible`))for(let e=0;e<2;e++){let{authConfig:{claimedAt:e}}=await i.fetch();if(t.current=Date.now(),e!==null){n();break}}}},{signal:r.signal}),()=>{r.abort()}},[]),s()}function j(e){try{return e()}catch{return`https://dashboard.clerk.com/last-active`}}var M=`18rem`,N=`220ms`,P=`180ms`,F=`cubic-bezier(0.2, 0, 0, 1)`,I=l`
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  background: none;
  border: none;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    avenir next,
    avenir,
    segoe ui,
    helvetica neue,
    helvetica,
    Cantarell,
    Ubuntu,
    roboto,
    noto,
    arial,
    sans-serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  text-decoration: none;
  color: inherit;
  appearance: none;
`;function L(e){return e?N:P}var R=l`
  ${I};
  margin: 0.75rem 0 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 1.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12px;
  color: #fde047;
  text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.32);
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 30.5%, rgba(0, 0, 0, 0.05) 100%), #454545;
  box-shadow:
    0px 0px 0px 1px rgba(255, 255, 255, 0.04) inset,
    0px 1px 0px 0px rgba(255, 255, 255, 0.04) inset,
    0px 0px 0px 1px rgba(0, 0, 0, 0.12),
    0px 1.5px 2px 0px rgba(0, 0, 0, 0.48),
    0px 0px 4px 0px rgba(243, 107, 22, 0) inset;
  outline: none;
  &:hover {
    background: #4b4b4b;
    transition: background-color 120ms ease-in-out;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
  &:focus-visible {
    outline: 2px solid #6c47ff;
    outline-offset: 2px;
  }
`,z={idle:{triggerWidth:`14.25rem`,title:`Configure your application`,description:n(a,{children:[r(`p`,{children:`Temporary API keys are enabled so you can get started immediately.`}),r(`ul`,{children:[`Add SSO connections (eg. GitHub)`,`Set up B2B authentication`,`Enable MFA`].map(e=>r(`li`,{children:e},e))}),r(`p`,{children:`Access the dashboard to customize auth settings and explore Clerk features.`})]}),cta:{kind:`link`,text:`Configure your application`,href:({claimUrl:e})=>e}},userCreated:{triggerWidth:`15.75rem`,title:`You've created your first user!`,description:r(`p`,{children:`Head to the dashboard to customize authentication settings, view user info, and explore more features.`}),cta:{kind:`link`,text:`Configure your application`,href:({claimUrl:e})=>e}},claimed:{triggerWidth:`14.25rem`,title:`Missing environment keys`,description:r(`p`,{children:`You claimed this application but haven't set keys in your environment. Get them from the Clerk Dashboard.`}),cta:{kind:`link`,text:`Get API keys`,href:({claimUrl:e})=>e}},completed:{triggerWidth:`10.5rem`,title:`Your app is ready`,description:({appName:e,instanceUrl:t})=>n(`p`,{children:[`Your application`,` `,r(`a`,{href:t,target:`_blank`,rel:`noopener noreferrer`,children:e}),` `,`has been configured. You may now customize your settings in the Clerk dashboard.`]}),cta:{kind:`action`,text:`Dismiss`,onClick:e=>{e?.().then(()=>{window.location.reload()})}}}};function B(e,t,n){return t?`completed`:e?`claimed`:n?`userCreated`:`idle`}function V(e,t){let n=z[e],r=typeof n.description==`function`?n.description({appName:t.appName,instanceUrl:t.instanceUrl}):n.description,i=n.cta,a=i.kind===`link`?{kind:`link`,text:i.text,href:typeof i.href==`function`?i.href({claimUrl:t.claimUrl,instanceUrl:t.instanceUrl}):i.href}:{kind:`action`,text:i.text,onClick:()=>i.onClick(t.onDismiss)};return{state:e,triggerWidth:n.triggerWidth,title:n.title,description:r,cta:a}}function H(e){let t=(0,f.useId)(),i=A(),{isDragging:a,cornerStyle:s,containerRef:c,onPointerDown:p,preventClick:m,isInitialized:h}=O(),g=!!i.authConfig.claimedAt,_=typeof e.onDismiss==`function`&&g,{isSignedIn:v}=o(),y=i.displayConfig.applicationName,b=(0,f.useMemo)(()=>{if(g)return e.copyKeysUrl;let t=new URL(e.claimUrl);return t.searchParams.append(`return_url`,window.location.href),t.href},[g,e.copyKeysUrl,e.claimUrl]),x=(0,f.useMemo)(()=>j(()=>{let t=d(e.copyKeysUrl);return new URL(`${t.baseDomain}/apps/${t.appId}/instances/${t.instanceId}/user-authentication/email-phone-username`).href}),[e.copyKeysUrl]),[S,C]=(0,f.useState)(!0),w=B(g,_,!!v),T=(0,f.useMemo)(()=>V(w,{appName:y,instanceUrl:x,claimUrl:b,onDismiss:e.onDismiss}),[w,y,x,b,e.onDismiss]),E=T.cta.kind===`link`?r(`a`,{href:T.cta.href,target:`_blank`,rel:`noopener noreferrer`,css:R,children:T.cta.text}):r(`button`,{type:`button`,onClick:T.cta.onClick,css:R,children:T.cta.text});return n(`div`,{ref:c,onPointerDown:S?void 0:p,style:{...s,opacity:h?void 0:0},"data-expanded":S,css:l`
        ${I};
        position: fixed;
        border-radius: ${S?`0.75rem`:`2.5rem`};
        background-color: #1f1f1f;
        box-shadow:
          0px 0px 0px 0.5px #2f3037 inset,
          0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset,
          0px 0px 0.8px 0.8px rgba(255, 255, 255, 0.2) inset,
          0px 0px 0px 0px rgba(255, 255, 255, 0.72),
          0px 16px 36px -6px rgba(0, 0, 0, 0.36),
          0px 6px 16px -2px rgba(0, 0, 0, 0.2);
        height: auto;
        isolation: isolate;
        transform: translateZ(0);
        backface-visibility: hidden;
        width: ${S?M:T.triggerWidth};
        cursor: ${a?`grabbing`:S?`default`:`grab`};
        touch-action: none;
        transition: ${a?`none`:h?`width ${L(S)} ${F}, border-radius ${L(S)} cubic-bezier(0.2, 0, 0, 1)`:`none`};

        @media (prefers-reduced-motion: reduce) {
          transition: none;
        }
        &:has(button:focus-visible) {
          outline: 2px solid #6c47ff;
          outline-offset: 2px;
        }
        &::before {
          content: '';
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background-image: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%);
          opacity: 0.16;
          transition: opacity ${L(S)} ${F};

          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
        }
        &[data-expanded='true']::before,
        &:hover::before {
          opacity: 0.2;
        }
      `,children:[n(`button`,{type:`button`,"aria-label":`Keyless prompt`,"aria-controls":t,"aria-expanded":S,onClick:()=>{m||C(e=>!e)},css:l`
          ${I};
          display: flex;
          align-items: center;
          width: 100%;
          border-radius: inherit;
          padding-inline: 0.75rem;
          gap: 0.25rem;
          height: 2.5rem;
          outline: none;
          cursor: pointer;
          user-select: none;
        `,children:[n(`svg`,{css:l`
            width: 1rem;
            height: 1rem;
            flex-shrink: 0;
          `,fill:`none`,viewBox:`0 0 128 128`,children:[r(`circle`,{cx:`64`,cy:`64`,r:`20`,fill:`#fff`}),r(`path`,{fill:`#fff`,fillOpacity:`.4`,d:`M99.572 10.788c1.999 1.34 2.17 4.156.468 5.858L85.424 31.262c-1.32 1.32-3.37 1.53-5.033.678A35.846 35.846 0 0 0 64 28c-19.882 0-36 16.118-36 36a35.846 35.846 0 0 0 3.94 16.391c.851 1.663.643 3.712-.678 5.033L16.646 100.04c-1.702 1.702-4.519 1.531-5.858-.468C3.974 89.399 0 77.163 0 64 0 28.654 28.654 0 64 0c13.163 0 25.399 3.974 35.572 10.788Z`}),r(`path`,{fill:`#fff`,d:`M100.04 111.354c1.702 1.702 1.531 4.519-.468 5.858C89.399 124.026 77.164 128 64 128c-13.164 0-25.399-3.974-35.572-10.788-2-1.339-2.17-4.156-.468-5.858l14.615-14.616c1.322-1.32 3.37-1.53 5.033-.678A35.847 35.847 0 0 0 64 100a35.846 35.846 0 0 0 16.392-3.94c1.662-.852 3.712-.643 5.032.678l14.616 14.616Z`})]}),r(`span`,{css:l`
            ${I};
            font-size: 0.875rem;
            font-weight: 500;
            color: #d9d9d9;
            white-space: nowrap;
          `,children:T.title}),r(`svg`,{css:l`
            width: 1rem;
            height: 1rem;
            flex-shrink: 0;
            color: #d9d9d9;
            margin-inline-start: auto;
            opacity: ${S?.5:0};
            transition: opacity ${L(S)} ease-out;

            @media (prefers-reduced-motion: reduce) {
              transition: none;
            }
            ${S&&l`
              button:hover & {
                opacity: 1;
              }
            `}
          `,viewBox:`0 0 16 16`,fill:`none`,"aria-hidden":`true`,xmlns:`http://www.w3.org/2000/svg`,children:r(`path`,{d:`M3.75 8H12.25`,stroke:`currentColor`,strokeWidth:`1.5`,strokeLinecap:`round`,strokeLinejoin:`round`})})]}),r(`div`,{id:t,...u(!S),css:l`
          ${I};
          display: grid;
          grid-template-rows: ${S?`1fr`:`0fr`};
          transition: grid-template-rows ${L(S)} ${F};

          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
        `,children:r(`div`,{css:l`
            ${I};
            min-height: 0;
            overflow: hidden;
          `,children:n(`div`,{css:l`
              ${I};
              width: ${M};
              padding-inline: 0.75rem;
              padding-block-end: 0.75rem;
              opacity: ${+!!S};
              transition: opacity ${L(S)} ${F};

              @media (prefers-reduced-motion: reduce) {
                transition: none;
              }
            `,children:[r(`div`,{css:l`
                ${I};
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                & ul {
                  ${I};
                  list-style: disc;
                  padding-left: 1rem;
                }
                & p,
                & li {
                  ${I};
                  color: #b4b4b4;
                  font-size: 0.8125rem;
                  font-weight: 400;
                  line-height: 1rem;
                  text-wrap: pretty;
                }
                & a {
                  color: #fde047;
                  font-weight: 500;
                  outline: none;
                  text-decoration: underline;
                  &:focus-visible {
                    outline: 2px solid #6c47ff;
                    outline-offset: 2px;
                  }
                }
              `,children:T.description}),E]})})})]})}function U(e){return r(c,{children:r(H,{...e})})}export{U as KeylessPrompt,B as getCurrentState,V as getResolvedContent};