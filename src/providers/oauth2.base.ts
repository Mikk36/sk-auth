import type { EndpointOutput } from "@sveltejs/kit/types/endpoint";
import type { Auth } from "../auth";
import type { CallbackResult } from "../types";
import { Provider, ProviderConfig } from "./base";
import type { RequestEvent } from "@sveltejs/kit";

export interface OAuth2Tokens {
  access_token: string;
  token_type: string;
}

export type ProfileCallback<ProfileType = any, TokensType = any, ReturnType = any> = (
  profile: ProfileType,
  tokens: TokensType,
) => ReturnType | Promise<ReturnType>;

export interface OAuth2BaseProviderConfig<ProfileType = any, TokensType = any>
  extends ProviderConfig {
  profile?: ProfileCallback<ProfileType, TokensType>;
}

export abstract class OAuth2BaseProvider<ProfileType,
  TokensType extends OAuth2Tokens,
  T extends OAuth2BaseProviderConfig,
  > extends Provider<T> {
  abstract getAuthorizationUrl(
    event: RequestEvent,
    auth: Auth,
    state: string,
    nonce: string,
  ): string | Promise<string>;

  abstract getTokens(code: string, redirectUri: string): TokensType | Promise<TokensType>;

  abstract getUserProfile(tokens: any): ProfileType | Promise<ProfileType>;

  async signin(event: RequestEvent, auth: Auth): Promise<EndpointOutput> {
    const { request: { method, headers }, url: {protocol, searchParams} } = event;
    let { url: {host} } = event;
    auth.scheme = protocol;
    if (host === "undefined" && headers.has("authority")) {
      host = <string>headers.get("authority");
    }
    if (host === "undefined" && headers.has("referer")) {
      host = new URL(<string>headers.get("referer")).host;
    }
    const state = [`redirect=${searchParams.get("redirect") ?? this.getUri(auth, "/", host)}`].join(",");
    const base64State = Buffer.from(state).toString("base64");
    const nonce = Math.round(Math.random() * 1000).toString(); // TODO: Generate random based on user values
    const redirectUrl = await this.getAuthorizationUrl(event, auth, base64State, nonce);

    if (method === "POST") {
      return {
        body: {
          redirect: redirectUrl,
        },
      };
    }

    return {
      status: 302,
      headers: {
        Location: redirectUrl,
      },
    };
  }

  getStateValue(query: URLSearchParams, name: string) {
    if (query.get("state")) {
      const state = Buffer.from(query.get("state")!, "base64").toString();
      return state
        .split(",")
        .find((state) => state.startsWith(`${name}=`))
        ?.replace(`${name}=`, "");
    }
  }

  async callback({ url: {host, protocol, searchParams}, request: { headers } }: RequestEvent, auth: Auth): Promise<CallbackResult> {
    auth.scheme = protocol;
    if (host === "undefined" && headers.has("authority")) {
      host = <string>headers.get("authority");
    }
    if (host === "undefined" && headers.has("referer")) {
      host = new URL(<string>headers.get("referer")).host;
    }

    const code = searchParams.get("code");
    const redirect = this.getStateValue(searchParams, "redirect");

    const tokens = await this.getTokens(code!, this.getCallbackUri(auth, host));
    let user = await this.getUserProfile(tokens);

    if (this.config.profile) {
      user = await this.config.profile(user, tokens);
    }

    return [user, redirect ?? this.getUri(auth, "/", host)];
  }
}
