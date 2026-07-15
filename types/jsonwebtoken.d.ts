declare module "jsonwebtoken" {
  export interface SignOptions {
    expiresIn?: string | number;
    algorithm?: string;
    [key: string]: unknown;
  }

  export interface VerifyOptions {
    algorithms?: string[];
    [key: string]: unknown;
  }

  export interface JwtPayload {
    [key: string]: unknown;
  }

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: VerifyOptions
  ): string | JwtPayload;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
  };

  export default jwt;
}
