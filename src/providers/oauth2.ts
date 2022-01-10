import type { ServerRequest } from "@sveltejs/kit/types/hooks";
import type { Auth } from "../auth";
import { ucFirst } from "../helpers";
import { OAuth2BaseProvider, OAuth2BaseProviderConfig, OAuth2Tokens } from "./oauth2.base";

export interface OAuth2ProviderConfig<ProfileType = any, TokensType extends OAuth2Tokens = any>
  extends OAuth2BaseProviderConfig<ProfileType, TokensType> {
  accessTokenUrl?: string;
  authorizationUrl?: string;
  profileUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string | string[];
  headers?: any;
  authorizationParams?: any;
  params?: any;
  grantType?: string;
  responseType?: string;
  contentType?: "application/json" | "application/x-www-form-urlencoded";
}

const defaultConfig: Partial<OAuth2ProviderConfig> = {
  responseType: "code",
  grantType: "authorization_code",
  contentType: "application/json",
};

export class OAuth2Provider<ProfileType = any,
  TokensType extends OAuth2Tokens = OAuth2Tokens,
  ConfigType extends OAuth2ProviderConfig = OAuth2ProviderConfig<ProfileType, TokensType>,
  > extends OAuth2BaseProvider<ProfileType, TokensType, ConfigType> {
  constructor(config: ConfigType) {
    super({
      ...defaultConfig,
      ...config,
    });
  }

  getAuthorizationUrl({ url: { host }, headers }: ServerRequest, auth: Auth, state: string, nonce: string) {
    if (":scheme" in headers) {
      auth.scheme = headers[":scheme"];
    }
    if ("x-forwarded-proto" in headers) {
      auth.scheme = headers["x-forwarded-proto"];
    }
    if (host === "undefined" && ":authority" in headers) {
      host = headers[":authority"];
    }
    const data = {
      state,
      nonce,
      response_type: this.config.responseType,
      client_id: this.config.clientId,
      scope: Array.isArray(this.config.scope) ? this.config.scope.join(" ") : this.config.scope!,
      redirect_uri: this.getCallbackUri(auth, host),
      ...(this.config.authorizationParams ?? {}),
    };

    return `${this.config.authorizationUrl}?${new URLSearchParams(data)}`;
  }

  async getTokens(code: string, redirectUri: string): Promise<TokensType> {
    const data: Record<string, any> = {
      code,
      grant_type: this.config.grantType,
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      client_secret: this.config.clientSecret,
      ...(this.config.params ?? {}),
    };

    let body: string;
    if (this.config.contentType === "application/x-www-form-urlencoded") {
      body = Object.entries(data)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
    } else {
      body = JSON.stringify(data);
    }

    const { default: nodeFetch } = await import("node-fetch");
    const res = await nodeFetch(this.config.accessTokenUrl!, {
      body,
      method: "POST",
      headers: {
        "Content-Type": this.config.contentType,
        ...(this.config.headers ?? {}),
      },
    });

    return <TokensType>await res.json();
  }

  async getUserProfile(tokens: TokensType): Promise<ProfileType> {
    const { default: nodeFetch } = await import("node-fetch");
    const res = await nodeFetch(this.config.profileUrl!, {
      headers: { Authorization: `${ucFirst(tokens.token_type)} ${tokens.access_token}` },
    });
    return <ProfileType>await res.json();
  }
}
