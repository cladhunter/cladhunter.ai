const jsrPattern = /^jsr:@supabase\/supabase-js@.+$/;

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('npm:')) {
    return defaultResolve(specifier.slice(4), context, defaultResolve);
  }

  if (jsrPattern.test(specifier)) {
    return defaultResolve('@supabase/supabase-js', context, defaultResolve);
  }

  return defaultResolve(specifier, context, defaultResolve);
}
