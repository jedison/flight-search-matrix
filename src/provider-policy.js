export const DEFAULT_PROVIDER_POLICY = Object.freeze({
  minDelaySeconds: 8,
  maxDelaySeconds: 16,
  maxBackoffSeconds: 120,
  backoffMultiplier: 2,
  jitterRatio: 0.2
});

export function effectivePolicy(settings = {}, adapter = '') {
  const override = settings.providerPolicies?.[adapter] || {};
  return { ...DEFAULT_PROVIDER_POLICY, minDelaySeconds: settings.minDelaySeconds ?? DEFAULT_PROVIDER_POLICY.minDelaySeconds, maxDelaySeconds: settings.maxDelaySeconds ?? DEFAULT_PROVIDER_POLICY.maxDelaySeconds, ...override };
}

export function delayForAttempt(policy, failureStreak = 0, random = Math.random) {
  const min = Math.max(0, Number(policy.minDelaySeconds) || 0);
  const max = Math.max(min, Number(policy.maxDelaySeconds) || min);
  const base = min + random() * (max - min);
  const multiplier = Math.pow(Math.max(1, Number(policy.backoffMultiplier) || 2), Math.max(0, failureStreak));
  const capped = Math.min(base * multiplier, Math.max(max, Number(policy.maxBackoffSeconds) || 120));
  const jitter = capped * Math.max(0, Number(policy.jitterRatio) || 0) * (random() * 2 - 1);
  return Math.max(0, Math.round((capped + jitter) * 1000));
}

