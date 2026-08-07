import type { JSX } from "solid-js"

export interface IconRecord {
  /** Inner SVG markup. Must be self-contained (no external defs). */
  body: (idPrefix: string) => JSX.Element
  /** Override stroke-width if the path is dense; defaults to 1.4. */
  strokeWidth?: number
}

export const CUSTOM_ICON_PATHS = {
  "editor-vscode": {
    body: (idPrefix) => (
      <>
        <defs>
          <mask
            id={`${idPrefix}-editor-vscode-mask`}
            mask-type="alpha"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="100"
            height="100"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.9119 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z"
              fill="white"
              stroke="none"
            />
          </mask>
          <filter
            id={`${idPrefix}-editor-vscode-filter-0`}
            x="-8.39411"
            y="15.8291"
            width="116.727"
            height="92.2456"
            filterUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB"
          >
            <feFlood flood-opacity="0" result="BackgroundImageFix" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
            <feOffset />
            <feGaussianBlur stdDeviation="4.16667" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          </filter>
          <filter
            id={`${idPrefix}-editor-vscode-filter-1`}
            x="60.4167"
            y="-8.07558"
            width="47.9167"
            height="116.151"
            filterUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB"
          >
            <feFlood flood-opacity="0" result="BackgroundImageFix" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
            <feOffset />
            <feGaussianBlur stdDeviation="4.16667" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          </filter>
          <linearGradient
            id={`${idPrefix}-editor-vscode-paint-0`}
            x1="49.9392"
            y1="0.257812"
            x2="49.9392"
            y2="99.7423"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="white" />
            <stop offset="1" stop-color="white" stop-opacity="0" />
          </linearGradient>
        </defs>
        <g transform="scale(0.16)" stroke="none">
          <g mask={`url(#${idPrefix}-editor-vscode-mask)`}>
            <path
              d="M96.4614 10.7962L75.8569 0.875542C73.4719 -0.272773 70.6217 0.211611 68.75 2.08333L1.29858 63.5832C-0.515693 65.2373 -0.513607 68.0937 1.30308 69.7452L6.81272 74.754C8.29793 76.1042 10.5347 76.2036 12.1338 74.9905L93.3609 13.3699C96.086 11.3026 100 13.2462 100 16.6667V16.4275C100 14.0265 98.6246 11.8378 96.4614 10.7962Z"
              fill="#0065A9"
            />
            <g filter={`url(#${idPrefix}-editor-vscode-filter-0)`}>
              <path
                d="M96.4614 89.2038L75.8569 99.1245C73.4719 100.273 70.6217 99.7884 68.75 97.9167L1.29858 36.4169C-0.515693 34.7627 -0.513607 31.9063 1.30308 30.2548L6.81272 25.246C8.29793 23.8958 10.5347 23.7964 12.1338 25.0095L93.3609 86.6301C96.086 88.6974 100 86.7538 100 83.3334V83.5726C100 85.9735 98.6246 88.1622 96.4614 89.2038Z"
                fill="#007ACC"
              />
            </g>
            <g filter={`url(#${idPrefix}-editor-vscode-filter-1)`}>
              <path
                d="M75.8578 99.1263C73.4721 100.274 70.6219 99.7885 68.75 97.9166C71.0564 100.223 75 98.5895 75 95.3278V4.67213C75 1.41039 71.0564 -0.223106 68.75 2.08329C70.6219 0.211402 73.4721 -0.273666 75.8578 0.873633L96.4587 10.7807C98.6234 11.8217 100 14.0112 100 16.4132V83.5871C100 85.9891 98.6234 88.1786 96.4586 89.2196L75.8578 99.1263Z"
                fill="#1F9CF0"
              />
            </g>
            <g style="mix-blend-mode:overlay" opacity="0.25">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M70.8511 99.3171C72.4261 99.9306 74.2221 99.8913 75.8117 99.1264L96.4 89.2197C98.5634 88.1787 99.9392 85.9892 99.9392 83.5871V16.4133C99.9392 14.0112 98.5635 11.8217 96.4001 10.7807L75.8117 0.873695C73.7255 -0.13019 71.2838 0.115699 69.4527 1.44688C69.1912 1.63705 68.942 1.84937 68.7082 2.08335L29.2943 38.0414L12.1264 25.0096C10.5283 23.7964 8.29285 23.8959 6.80855 25.246L1.30225 30.2548C-0.513334 31.9064 -0.515415 34.7627 1.29775 36.4169L16.1863 50L1.29775 63.5832C-0.515415 65.2374 -0.513334 68.0937 1.30225 69.7452L6.80855 74.754C8.29285 76.1042 10.5283 76.2036 12.1264 74.9905L29.2943 61.9586L68.7082 97.9167C69.3317 98.5405 70.0638 99.0104 70.8511 99.3171ZM74.9544 27.2989L45.0483 50L74.9544 72.7012V27.2989Z"
                fill={`url(#${idPrefix}-editor-vscode-paint-0)`}
              />
            </g>
          </g>
        </g>
      </>
    ),
  },
  "editor-pycharm": {
    body: (idPrefix) => (
      <>
        <defs>
          <linearGradient
            id={`${idPrefix}-editor-pycharm-gradient-a`}
            x1="7.62141"
            x2="61.2476"
            y1="64.7192"
            y2="39.8558"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset=".1" stop-color="#00D886" />
            <stop offset=".59" stop-color="#F0EB18" />
          </linearGradient>
          <linearGradient
            id={`${idPrefix}-editor-pycharm-gradient-b`}
            x1="60.0186"
            x2="1.31317"
            y1="59.7778"
            y2="1.07229"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset=".3" stop-color="#F0EB18" />
            <stop offset=".7" stop-color="#00C4F4" />
          </linearGradient>
        </defs>
        <g transform="scale(0.25)" stroke="none">
          <path
            fill="#00D886"
            d="m5.81934 48.0512.00174 11.8755c0 2.2493 1.82342 4.0721 4.07273 4.0721H21.4004c1.1887 0 2.3186-.5196 3.0924-1.422L57.202 24.4154c.6325-.7383.9804-1.6786.9804-2.6508V9.88913c0-2.24931-1.8234-4.07272-4.0727-4.07272H42.6013c-1.1887 0-2.3185.51956-3.0924 1.42196L6.7997 45.3998c-.63302.7384-.98036 1.6786-.98036 2.6514Z"
          />
          <path
            fill={`url(#${idPrefix}-editor-pycharm-gradient-a)`}
            d="M5.81836 49.4825v10.4466c0 2.2493 1.82342 4.0727 4.07273 4.0727H22.9837c.1926 0 .3852-.0139.576-.0407l36.9438-5.2771c2.0066-.2868 3.4967-2.0049 3.4967-4.032V38.979c0-2.2499-1.824-4.0733-4.0739-4.0727l-18.5385.0046c-.4375 0-.8721.0704-1.287.2089L8.60294 45.6193c-1.66284.5544-2.78458 2.1108-2.78458 3.8638v-.0006Z"
          />
          <path
            fill={`url(#${idPrefix}-editor-pycharm-gradient-b)`}
            d="M0 4.07273V38.041c0 1.6291.971054 3.1017 2.46807 3.7434L39.9587 57.8525c.5068.217 1.0531.3293 1.6046.3293h18.364c2.2493 0 4.0727-1.8234 4.0727-4.0727v-17.966c0-.8046-.2385-1.5912-.6854-2.2609L41.9119 1.81353C41.1561.681309 39.8854.001745 38.5245.001745L4.07273 0C1.82342 0 0 1.82342 0 4.07273Z"
          />
          <path fill="#000" d="M52 12H12v40h40V12Z" />
          <path
            fill="#fff"
            fill-rule="evenodd"
            d="M23.5363 16.9676h-6.4407v15.0055h2.9261v-5.6702h3.4296c1.0715 0 2.0115-.1929 2.8188-.5788.8148-.3927 1.4401-.9434 1.8759-1.6508.4427-.7074.6643-1.5434.6643-2.465 0-.9216-.2182-1.7324-.654-2.4329-.4289-.7005-1.0433-1.2431-1.8437-1.629-.8005-.3859-1.7261-.5788-2.7763-.5788Zm1.0927 6.6349c-.3646.1785-.7929.2681-1.2862.2681h-3.3229v-4.4695h3.3229c.4933 0 .9216.0924 1.2862.2784.3715.178.6569.4353.8573.7718.2004.3278.3003.7286.3003 1.1788 0 .4502-.1005.8469-.3003 1.1897-.1998.3365-.4858.5966-.8573.7827Z"
            clip-rule="evenodd"
          />
          <path
            fill="#fff"
            d="M33.3821 31.2232c1.1651.6713 2.4656 1.0077 3.9017 1.0077v-.0011c1.2144 0 2.3295-.2251 3.3441-.6753 1.0146-.4501 1.8575-1.0783 2.5294-1.8862.6787-.8148 1.1328-1.7473 1.3614-2.7975H41.453c-.2004.5426-.5001 1.0221-.9003 1.4361-.3933.4076-.8688.7223-1.4257.9434-.557.221-1.1645.3324-1.822.3324-.886 0-1.6864-.221-2.4007-.6643-.7149-.4433-1.2759-1.0502-1.683-1.8219-.4002-.7781-.6-1.6543-.6-2.6259 0-.9715.1998-1.8437.6-2.6154.4077-.7786.9681-1.3896 1.683-1.8329.7143-.4432 1.5147-.6643 2.4007-.6643.6569 0 1.2644.1114 1.822.3325.5575.221 1.0324.5397 1.4257.9537.4002.4077.6999.8831.9003 1.4257h3.0657c-.2291-1.0502-.6827-1.9787-1.3614-2.7866-.6719-.8147-1.5148-1.4469-2.5294-1.8971-1.0146-.4502-2.1297-.6753-3.3441-.6753-1.4367 0-2.7372.3388-3.9017 1.0181-1.165.6712-2.0797 1.6009-2.7441 2.7866-.6643 1.1788-.9968 2.4972-.9968 3.955 0 1.4579.3325 2.7803.9968 3.966.6649 1.1789 1.5791 2.1073 2.7441 2.7866Z"
          />
          <path fill="#fff" d="M16.9941 44.001h16v3h-16v-3Z" />
        </g>
      </>
    ),
  },
  "editor-webstorm": {
    body: () => (
      <>
        <path d="M3.1 4 8.2 2.4 13 4.4l-.8 8.1-5.7 1.1L3 10.9Z" fill="currentColor" stroke="none" />
        <rect x="5" y="5" width="6" height="6" rx="0.6" fill="var(--task-bar-bg)" stroke="none" />
        <path d="M6.3 8.4 7 6.7l1 1.7 1-1.7.8 1.7" />
      </>
    ),
  },
  "editor-intellij": {
    body: () => (
      <>
        <path d="M2.8 3.8 7.6 2.3l5.6 2.2v7.7l-5.6 1.5-4.8-2.2Z" fill="currentColor" stroke="none" />
        <rect x="5" y="5.1" width="6" height="5.8" rx="0.6" fill="var(--task-bar-bg)" stroke="none" />
        <path d="M6.5 9.5h3" />
      </>
    ),
  },
  "editor-cursor": {
    body: () => (
      <>
        <path d="M3 2.6 13 8 8.2 9.1 6.6 13.4Z" fill="currentColor" stroke="none" />
        <path d="M6.4 5.7 9.7 7.6 7.8 8 7 10.1Z" fill="var(--task-bar-bg)" stroke="none" />
      </>
    ),
  },
  github: {
    body: () => (
      <path
        d="M8 1C4.1 1 1 4.1 1 8c0 3.1 2 5.7 4.8 6.6.4.1.5-.2.5-.4v-1.3C4.2 13.3 3.7 12 3.7 12c-.3-.8-.8-1-.8-1-.6-.4.1-.4.1-.4.7.1 1.1.7 1.1.7.6 1.1 1.7.8 2.1.6.1-.4.3-.8.4-.9-1.7-.2-3.5-.9-3.5-3.8 0-.8.3-1.5.7-2-.1-.2-.3-1 .1-2 0 0 .6-.2 2 .8.6-.2 1.2-.3 1.8-.3s1.2.1 1.8.3c1.4-1 2-.8 2-.8.4 1 .2 1.8.1 2 .5.5.7 1.2.7 2 0 2.9-1.8 3.6-3.5 3.8.3.2.5.7.5 1.4v2.1c0 .2.1.5.5.4C13 13.7 15 11.1 15 8c0-3.9-3.1-7-7-7z"
        fill="currentColor"
        stroke="none"
      />
    ),
  },
} as const satisfies Record<string, IconRecord>

export type CustomIconName = keyof typeof CUSTOM_ICON_PATHS
