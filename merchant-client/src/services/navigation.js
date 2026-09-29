export function accountDestination(user, requested) {
  if (!['retailer', 'wholesaler', 'admin'].includes(user?.role)) return '/login';
  if (user.role === 'wholesaler' && user.verification_status !== 'verified') return '/wholesaler/profile';
  const home = `/${user.role}`;
  if (typeof requested !== 'string' || !requested.startsWith('/') || requested.startsWith('//') || /[\\\s]/.test(requested)) return home;
  try {
    const url = new URL(requested, 'https://navigation.invalid');
    if (url.origin !== 'https://navigation.invalid' || !(url.pathname === home || url.pathname.startsWith(home + '/'))) return home;
    return url.pathname + url.search + url.hash;
  } catch { return home; }
}
