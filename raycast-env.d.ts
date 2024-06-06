/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Language - Your preferred language. (Only Portuguese is not using machine translation) */
  "language": "pt" | "en" | "es" | "fr" | "de" | "it" | "ja" | "ko" | "zh-CN",
  /** News Source - Select between the various Portuguese Football sources */
  "dataSources": "abola" | "maisfutebol" | "record"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `index` command */
  export type Index = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
}

