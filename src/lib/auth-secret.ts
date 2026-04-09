export function getAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  if (secret && secret.length > 0) return secret;

  return "dev_friopro_fixed_secret_change_me";
}
