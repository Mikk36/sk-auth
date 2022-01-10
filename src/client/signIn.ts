interface SignInConfig {
  redirectUrl?: string;
}

export async function signIn(provider: string, data?: any, config?: SignInConfig) {
  if (data) {
    const path = `/api/auth/callback/${provider}`;
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return await res.json();
  }

  let redirectUrl: string | undefined;
  if (config?.redirectUrl) {
    redirectUrl = config.redirectUrl;
  } else {
    let $val: any | undefined;
    if ($val) {
      redirectUrl = `${$val.url.host}${$val.url.path}?${$val.url.query}`;
    }
  }

  const queryData = {
    redirect: redirectUrl ?? "/",
  };
  const query = new URLSearchParams(queryData);
  return `/api/auth/login/${provider}?${query}`;
}
