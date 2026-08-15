import{o as e,t}from"./react-CZmEMrhH.js";import{D as n,E as r,G as i,H as a,T as o}from"./sidepanel-34yG2Zf6.js";import{d as s}from"./customizables-BQujCQm0.js";import{n as c}from"./EnvironmentContext-DGY7iXhi.js";import{r as l}from"./OptionsContext-CJ9UYwVB.js";import{t as u}from"./InternalThemeProvider-Cmgc53_n.js";import{t as d}from"./emotion-react.browser.esm-CkYOwb9I.js";import{t as f}from"./Modal-At4cLhZh.js";import{t as p}from"./Portal-DR222mHX.js";import{i as m,n as h,r as g,t as _}from"./shared-CLeKjowe.js";var v=e(t(),1),y=`https://dashboard.clerk.com/~/organizations-settings`,b=({caller:e,onSuccess:t,onClose:a})=>{let u=i(),[g,_]=(0,v.useState)(!1),[b,x]=(0,v.useState)(!1),[w,D]=(0,v.useState)(null),[O,A]=(0,v.useState)(!1),j=(0,v.useRef)(null),F=c(),I=(0,v.useId)(),L=l(),R=L.__internal_keyless_claimKeylessApplicationUrl,z=L.__internal_keyless_copyInstanceKeysUrl,B=!!R&&!!z,V=F.authConfig.claimedAt!==null,H=b&&B&&!V,U=!e.startsWith(`use`),W=F?.organizationSettings.forceOrganizationSelection!==void 0;return r(p,{children:r(f,{canCloseModal:!1,containerSx:()=>({alignItems:`center`}),initialFocusRef:j,children:n(h,{sx:()=>({display:`flex`,flexDirection:`column`,width:`30rem`,maxWidth:`calc(100vw - 2rem)`}),children:[n(s,{direction:`col`,sx:e=>({padding:`${e.sizes.$4} ${e.sizes.$6}`,paddingBottom:e.sizes.$4,gap:e.sizes.$2}),children:[n(s,{as:`header`,align:`center`,sx:e=>({gap:e.sizes.$2}),children:[r(P,{isEnabled:b}),r(`h1`,{css:[m,d`
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 500;
                    outline: none;
                  `],tabIndex:-1,ref:j,children:b?`Organizations feature enabled`:`Organizations feature required`})]}),r(s,{direction:`col`,align:`start`,sx:e=>({gap:e.sizes.$0x5}),children:b?n(`p`,{css:[m,d`
                      color: #b4b4b4;
                      font-size: 0.8125rem;
                      font-weight: 400;
                      line-height: 1.3;
                    `],children:[H?w?`Organizations are now enabled and a default organization named "${w}" was created. Claim your application to save this configuration and access the full dashboard.`:`Organizations are now enabled! Claim your application to save this configuration and access the full dashboard.`:u.user&&w?`The Organizations feature has been enabled for your application. A default organization named "${w}" was created automatically. You can manage or rename it in your`:`The Organizations feature has been enabled for your application. You can manage it in your`,!H&&n(o,{children:[` `,r(N,{href:y,target:`_blank`,rel:`noopener noreferrer`,children:`dashboard`}),`.`]})]}):n(o,{children:[n(`p`,{id:I,css:[m,d`
                        color: #b4b4b4;
                        font-size: 0.8125rem;
                        font-weight: 400;
                        line-height: 1.23;
                      `],children:[`Enable Organizations to use`,` `,r(`code`,{css:[m,d`
                          font-size: 0.75rem;
                          color: white;
                          font-family: monospace;
                          line-height: 1.23;
                        `],children:U?`<${e} />`:e}),` `]}),r(N,{href:`https://clerk.com/docs/guides/organizations/overview`,target:`_blank`,rel:`noopener noreferrer`,children:`Learn more`})]})}),W&&!b&&r(s,{sx:e=>({marginTop:e.sizes.$2}),direction:`col`,children:n(k,{value:O?`optional`:`required`,onChange:e=>A(e===`optional`),labelledBy:I,children:[r(M,{value:`required`,label:n(s,{wrap:`wrap`,sx:e=>({columnGap:e.sizes.$2,rowGap:e.sizes.$1}),children:[r(`span`,{children:`Membership required`}),r(E,{children:`Standard`})]}),description:n(o,{children:[r(`span`,{className:`block`,children:`Users need to belong to at least one organization.`}),r(`span`,{children:`Common for most B2B SaaS applications`})]})}),r(M,{value:`optional`,label:`Membership optional`,description:`Users can work outside of an organization with a personal account`})]})})]}),r(`span`,{css:d`
              height: 1px;
              display: block;
              width: calc(100% - 2px);
              margin-inline: auto;
              background-color: #151515;
              box-shadow: 0px 1px 0px 0px #424242;
            `}),r(s,{justify:`center`,sx:e=>({padding:`${e.sizes.$4} ${e.sizes.$6}`,gap:e.sizes.$3,justifyContent:`flex-end`}),children:b?H?n(o,{children:[r(T,{variant:`outline`,onClick:()=>{t?.()},children:u.user?`Continue`:`I’ll do it later`}),r(N,{href:R,target:`_blank`,rel:`noopener noreferrer`,onClick:e=>{if(R){let t=new URL(R);t.searchParams.append(`return_url`,window.location.href),e.currentTarget.href=t.href}u.__internal_closeEnableOrganizationsPrompt?.()},css:d`
                      ${S}
                      ${C}
                      color: #fde047;
                      text-decoration: none;
                    `,children:`Claim your application`})]}):r(T,{variant:`solid`,onClick:()=>{u.user?t?.():(u.redirectToSignIn(),u.__internal_closeEnableOrganizationsPrompt?.())},children:u.user?`Continue`:`Sign in to continue`}):n(o,{children:[r(T,{variant:`outline`,onClick:()=>{u?.__internal_closeEnableOrganizationsPrompt?.(),a?.()},children:`I'll remove it myself`}),r(T,{variant:`solid`,onClick:()=>{_(!0);let e={enable_organizations:!0};W&&(e.organization_allow_personal_accounts=O),F.__internal_enableEnvironmentSetting(e).then(async()=>{D((await u.user?.getOrganizationMemberships())?.data[0]?.organization.name??null),x(!0),_(!1)}).catch(()=>{_(!1)})},disabled:g,children:`Enable Organizations`})]})})]})})})},x=e=>r(u,{children:r(b,{...e})}),S=d`
  ${m};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.75rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12px;
  color: white;
  text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.32);
  white-space: nowrap;
  user-select: none;
  color: white;
  outline: none;

  &:not(:disabled) {
    transition: 120ms ease-in-out;
    transition-property: background-color, border-color, box-shadow, color;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:focus-visible:not(:disabled) {
    outline: 2px solid white;
    outline-offset: 2px;
  }
`,C=d`
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 30.5%, rgba(0, 0, 0, 0.05) 100%), #454545;
  box-shadow:
    0 0 3px 0 rgba(253, 224, 71, 0) inset,
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
    0 0 0 1px rgba(0, 0, 0, 0.12),
    0 1.5px 2px 0 rgba(0, 0, 0, 0.48);

  &:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0) 30.5%, rgba(0, 0, 0, 0.15) 100%), #5f5f5f;
    box-shadow:
      0 0 3px 0 rgba(253, 224, 71, 0) inset,
      0 0 0 1px rgba(255, 255, 255, 0.04) inset,
      0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1.5px 2px 0 rgba(0, 0, 0, 0.48);
  }
`,w={solid:C,outline:d`
  border: 1px solid rgba(118, 118, 132, 0.25);
  background: rgba(69, 69, 69, 0.1);

  &:hover:not(:disabled) {
    border-color: rgba(118, 118, 132, 0.5);
  }
`},T=(0,v.forwardRef)(({variant:e=`solid`,...t},n)=>r(`button`,{ref:n,type:`button`,css:[S,w[e]],...t})),E=({children:e})=>r(`span`,{css:d`
        ${m};
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-size: 0.6875rem;
        font-weight: 500;
        line-height: 1.23;
        background-color: #ebebeb;
        color: #2b2b34;
        white-space: nowrap;
      `,children:e}),[D,O]=a(`RadioGroupContext`),k=({value:e,onChange:t,children:n,labelledBy:i})=>{let a=(0,v.useId)(),o=v.useMemo(()=>({value:{name:a,value:e,onChange:t}}),[a,e,t]);return r(D.Provider,{value:o,children:r(s,{role:`radiogroup`,direction:`col`,gap:3,"aria-orientation":`vertical`,"aria-labelledby":i,children:n})})},A=`1rem`,j=`0.5rem`,M=({value:e,label:t,description:i})=>{let{name:a,value:o,onChange:c}=O(),l=(0,v.useId)(),u=e===o;return n(s,{direction:`col`,gap:1,children:[n(`label`,{css:d`
          ${m};
          display: flex;
          align-items: flex-start;
          gap: ${j};
          cursor: pointer;
          user-select: none;

          &:has(input:focus-visible) > span:first-of-type {
            outline: 2px solid white;
            outline-offset: 2px;
          }

          &:hover:has(input:not(:checked)) > span:first-of-type {
            background-color: rgba(255, 255, 255, 0.08);
          }

          &:hover:has(input:checked) > span:first-of-type {
            background-color: rgba(108, 71, 255, 0.8);
            background-color: color-mix(in srgb, #6c47ff 80%, transparent);
          }
        `,children:[r(`input`,{type:`radio`,name:a,value:e,checked:u,onChange:()=>c(e),"aria-describedby":i?l:void 0,css:d`
            ${m};
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border-width: 0;
          `}),r(`span`,{"aria-hidden":`true`,css:d`
            ${m};
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: ${A};
            height: ${A};
            margin-top: 0.125rem;
            flex-shrink: 0;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.3);
            background-color: transparent;
            transition: 120ms ease-in-out;
            transition-property: border-color, background-color, box-shadow;

            ${u&&d`
              border-width: 2px;
              border-color: #6c47ff;
              background-color: #6c47ff;
              background-color: color-mix(in srgb, #6c47ff 100%, transparent);
              box-shadow: 0 0 0 2px rgba(108, 71, 255, 0.2);
            `}

            &::after {
              content: '';
              position: absolute;
              width: 0.375rem;
              height: 0.375rem;
              border-radius: 50%;
              background-color: white;
              opacity: ${+!!u};
              transform: scale(${+!!u});
              transition: 120ms ease-in-out;
              transition-property: opacity, transform;
            }
          `}),r(`span`,{css:[m,d`
              font-size: 0.875rem;
              font-weight: 500;
              line-height: 1.25;
              color: white;
            `],children:t})]}),i&&r(`span`,{id:l,css:[m,d`
              padding-inline-start: calc(${A} + ${j});
              font-size: 0.75rem;
              line-height: 1.33;
              color: #c3c3c6;
              text-wrap: pretty;
            `],children:i})]})},N=(0,v.forwardRef)(({children:e,css:t,...n},i)=>r(`a`,{ref:i,...n,css:[m,d`
            color: #a8a8ff;
            font-size: inherit;
            font-weight: 500;
            line-height: 1.3;
            font-size: 0.8125rem;
            min-width: 0;
          `,t],children:e})),P=({isEnabled:e})=>{let[t,i]=(0,v.useState)(0);(0,v.useLayoutEffect)(()=>{if(e){i(e=>e===0?180:0);return}let t=setInterval(()=>{i(e=>e===0?180:0)},2e3);return()=>clearInterval(t)},[e]);let a=`idle`,o=`warning`;e&&(t===0?(a=`success`,o=`warning`):(o=`success`,a=`idle`));let s=e=>{switch(e){case`idle`:return r(_,{});case`success`:return r(g,{css:d`
              width: 1.25rem;
              height: 1.25rem;
            `});case`warning`:return n(`svg`,{css:d`
              width: 1.25rem;
              height: 1.25rem;
            `,viewBox:`0 0 20 20`,fill:`none`,xmlns:`http://www.w3.org/2000/svg`,children:[r(`path`,{opacity:`0.2`,d:`M17.25 10C17.25 14.0041 14.0041 17.25 10 17.25C5.99594 17.25 2.75 14.0041 2.75 10C2.75 5.99594 5.99594 2.75 10 2.75C14.0041 2.75 17.25 5.99594 17.25 10Z`,fill:`#EAB308`}),r(`path`,{fillRule:`evenodd`,clipRule:`evenodd`,d:`M10 3.5C6.41015 3.5 3.5 6.41015 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.41015 13.5899 3.5 10 3.5ZM2 10C2 5.58172 5.58172 2 10 2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10Z`,fill:`#EAB308`}),r(`path`,{fillRule:`evenodd`,clipRule:`evenodd`,d:`M10 6C10.5523 6 11 6.44772 11 7V9C11 9.55228 10.5523 10 10 10C9.44772 10 9 9.55228 9 9V7C9 6.44772 9.44772 6 10 6Z`,fill:`#EAB308`}),r(`path`,{fillRule:`evenodd`,clipRule:`evenodd`,d:`M10 12C10.5523 12 11 12.4477 11 13V13.01C11 13.5623 10.5523 14.01 10 14.01C9.44772 14.01 9 13.5623 9 13.01V13C9 12.4477 9.44772 12 10 12Z`,fill:`#EAB308`})]})}};return r(`div`,{css:d`
        perspective: 1000px;
        width: 1.25rem;
        height: 1.25rem;
      `,children:n(`div`,{css:d`
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.6s ease-in-out;
          transform: rotateY(${t}deg);

          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
        `,children:[r(`span`,{"aria-hidden":!0,css:d`
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-font-smoothing: antialiased;
            transform: rotateY(0deg);
          `,children:s(a)}),r(`span`,{"aria-hidden":!0,css:d`
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            transform: rotateY(180deg);
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-font-smoothing: antialiased;
          `,children:s(o)})]})})};export{x as EnableOrganizationsPrompt};