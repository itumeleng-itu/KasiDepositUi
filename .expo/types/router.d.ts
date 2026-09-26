/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `/history`; params?: Router.UnknownInputParams; } | { pathname: `/status/[id]`, params: Router.UnknownInputParams & { id: string | number; } } | { pathname: `/history/[id]`, params: Router.UnknownInputParams & { id: string | number; } };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; } | { pathname: `/history`; params?: Router.UnknownOutputParams; } | { pathname: `/status/[id]`, params: Router.UnknownOutputParams & { id: string; } } | { pathname: `/history/[id]`, params: Router.UnknownOutputParams & { id: string; } };
      href: Router.RelativePathString | Router.ExternalPathString | `/_sitemap${`?${string}` | `#${string}` | ''}` | `/history${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `/history`; params?: Router.UnknownInputParams; } | `/status/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ''}` | `/history/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ''}` | { pathname: `/status/[id]`, params: Router.UnknownInputParams & { id: string | number; } } | { pathname: `/history/[id]`, params: Router.UnknownInputParams & { id: string | number; } };
    }
  }
}
