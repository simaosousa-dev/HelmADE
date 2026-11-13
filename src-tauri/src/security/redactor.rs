//! Streamer Shield: masks secrets in terminal output and Team Wire messages.
//!
//! Every pattern uses bounded quantifiers. A pattern only has to recognise the *start*
//! of a secret; the mask is then extended over the rest of the contiguous token, so a
//! secret longer than a pattern's upper bound never leaks its tail.

use regex::Regex;
use std::borrow::Cow;
use std::sync::LazyLock;

pub const MASK: &str = "[SECRET_MASKED]";

/// A partial line longer than this is no longer held back in full.
const MAX_HELD_LINE: usize = 4096;
/// Longest trailing token kept back when a line exceeds `MAX_HELD_LINE`.
const MAX_HELD_TOKEN: usize = 512;
/// Upper bound when extending a mask over the rest of a token.
const MAX_TOKEN_EXTENSION: usize = 16 * 1024;

/// Secrets recognisable by their own shape. The whole match is masked.
const TOKEN_PATTERNS: &[(&str, &str)] = &[
    ("anthropic", r"\bsk-ant-[A-Za-z0-9_-]{20,64}"),
    ("openai-scoped", r"\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,64}"),
    ("openrouter", r"\bsk-or-v1-[a-f0-9]{32,64}"),
    ("openai-legacy", r"\bsk-[A-Za-z0-9]{32,64}"),
    ("github-token", r"\bgh[pousr]_[A-Za-z0-9]{36,64}"),
    ("github-fine-grained", r"\bgithub_pat_[A-Za-z0-9_]{22,64}"),
    ("gitlab", r"\bgl(?:pat|dt|rt|ptt|soat|cbt|ft|imt)-[A-Za-z0-9_-]{20,64}"),
    ("aws-access-key-id", r"\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b"),
    ("google-api-key", r"\bAIza[0-9A-Za-z_-]{35}"),
    ("google-oauth-token", r"\bya29\.[0-9A-Za-z_-]{20,64}"),
    ("google-oauth-secret", r"\bGOCSPX-[A-Za-z0-9_-]{28}"),
    ("firebase-fcm", r"\bAAAA[A-Za-z0-9_-]{7}:APA91b[A-Za-z0-9_-]{40,64}"),
    ("slack-token", r"\bxox[abeprs]-[A-Za-z0-9-]{10,64}"),
    ("slack-app-token", r"\bxapp-[0-9]-[A-Z0-9]{8,12}-[0-9]{10,14}-[a-f0-9]{32,64}"),
    (
        "slack-webhook",
        r"https://hooks\.slack\.com/services/T[A-Z0-9]{6,12}/B[A-Z0-9]{6,12}/[A-Za-z0-9]{20,32}",
    ),
    ("stripe-key", r"\b[srp]k_(?:live|test)_[0-9a-zA-Z]{16,64}"),
    ("stripe-webhook", r"\bwhsec_[A-Za-z0-9+/=]{24,64}"),
    ("twilio", r"\b(?:SK|AC)[0-9a-f]{32}\b"),
    ("sendgrid", r"\bSG\.[A-Za-z0-9_-]{16,32}\.[A-Za-z0-9_-]{32,64}"),
    ("npm", r"\bnpm_[A-Za-z0-9]{36}"),
    ("pypi", r"\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{40,64}"),
    ("huggingface", r"\bhf_[A-Za-z0-9]{30,64}"),
    (
        "jwt",
        r"\beyJ[A-Za-z0-9_-]{8,64}\.eyJ[A-Za-z0-9_-]{8,64}",
    ),
    ("mapbox", r"\b[sp]k\.eyJ[A-Za-z0-9_-]{20,64}"),
    ("digitalocean", r"\bdo[pors]_v1_[a-f0-9]{64}"),
    ("shopify", r"\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}"),
    ("linear", r"\blin_api_[A-Za-z0-9]{40}"),
    ("notion", r"\b(?:secret_[A-Za-z0-9]{43}|ntn_[A-Za-z0-9]{40,60})"),
    (
        "discord-bot",
        r"\b[MNO][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,40}",
    ),
    ("telegram-bot", r"\b[0-9]{8,10}:AA[A-Za-z0-9_-]{33}"),
    ("mailgun", r"\bkey-[0-9a-f]{32}\b"),
    ("mailchimp", r"\b[0-9a-f]{32}-us[0-9]{1,2}\b"),
    ("square", r"\b(?:sq0(?:atp|csp)-[A-Za-z0-9_-]{22,43}|EAAA[A-Za-z0-9_-]{60})"),
    ("supabase", r"\b(?:sbp_[a-f0-9]{40}|sb_secret_[A-Za-z0-9_-]{20,64})"),
    ("groq", r"\bgsk_[A-Za-z0-9]{40,64}"),
    ("xai", r"\bxai-[A-Za-z0-9]{40,64}"),
    ("replicate", r"\br8_[A-Za-z0-9]{37}"),
    ("perplexity", r"\bpplx-[A-Za-z0-9]{40,64}"),
    ("databricks", r"\bdapi[a-f0-9]{32}"),
    ("doppler", r"\bdp\.(?:pt|st|ct|sa|scim|audit)\.[A-Za-z0-9]{40,44}"),
    ("postman", r"\bPMAK-[a-f0-9]{24}-[a-f0-9]{34}"),
    ("sentry", r"\bsntry[su]_[A-Za-z0-9+/=_-]{40,64}"),
    ("newrelic", r"\bNR(?:AK|II|AA)-[A-Za-z0-9]{27,42}"),
    ("figma", r"\bfigd_[A-Za-z0-9_-]{40,64}"),
    ("age-secret-key", r"\bAGE-SECRET-KEY-1[0-9A-Z]{58}"),
    ("vault", r"\bhv[sb]\.[A-Za-z0-9_-]{24,64}"),
    ("terraform-cloud", r"\b[A-Za-z0-9]{14}\.atlasv1\.[A-Za-z0-9_-]{60,64}"),
    ("dropbox", r"\bsl\.[A-Za-z0-9_-]{60,64}"),
    ("atlassian", r"\bATATT3xFfGF0[A-Za-z0-9_=-]{50,64}"),
    ("docker-hub", r"\bdckr_pat_[A-Za-z0-9_-]{27}"),
    ("grafana", r"\bgl(?:c|sa)_[A-Za-z0-9+/=_]{32,64}"),
    ("planetscale", r"\bpscale_(?:tkn|pw|oauth)_[A-Za-z0-9._=-]{32,64}"),
    ("fly-io", r"\bfo1_[A-Za-z0-9_-]{43}"),
    ("pulumi", r"\bpul-[a-f0-9]{40}"),
    ("cloudflare-origin-ca", r"\bv1\.0-[a-f0-9]{24}-[a-f0-9]{40,64}"),
];

/// Secrets recognisable only by what precedes them. Only the `s` group is masked.
const CONTEXT_PATTERNS: &[(&str, &str)] = &[
    (
        "env-assignment",
        r#"\b[A-Z][A-Z0-9_]{0,60}(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIALS?)[A-Z0-9_]{0,60}["']?[ \t]{0,2}[=:][ \t]{0,2}["']?(?P<s>[^\s"'`]{8,64})"#,
    ),
    (
        "quoted-assignment",
        r#"(?i)\b(?:password|passwd|secret|api[_-]?key|token)[ \t]{0,2}[=:][ \t]{0,2}["'](?P<s>[^"'\s]{6,64})"#,
    ),
    (
        "cli-flag",
        r"(?i)--(?:password|token|api-key|secret|access-key)[= ](?P<s>[^\s-][^\s]{5,64})",
    ),
    (
        "bearer-header",
        r"(?i)\bBearer[ \t]{1,3}(?P<s>[A-Za-z0-9._~+/=-]{16,64})",
    ),
    (
        "basic-header",
        r"(?i)\bAuthorization:[ \t]{0,3}Basic[ \t]{1,3}(?P<s>[A-Za-z0-9+/=]{8,64})",
    ),
    (
        "url-credentials",
        r"\b[a-z][a-z0-9+.-]{1,20}://[^\s:/@]{1,128}:(?P<s>[^\s@/]{3,64})@",
    ),
    (
        "aws-credentials-file",
        r"(?i)\baws_secret_access_key[ \t]{0,3}=[ \t]{0,3}(?P<s>[A-Za-z0-9/+=]{40})",
    ),
    (
        "azure-connection-string",
        r"\b(?:AccountKey|SharedAccessKey|SharedAccessSignature)=(?P<s>[A-Za-z0-9+/=%&-]{20,64})",
    ),
];

static TOKENS: LazyLock<Regex> = LazyLock::new(|| {
    let alternation: Vec<String> = TOKEN_PATTERNS
        .iter()
        .map(|(_, pattern)| format!("(?:{pattern})"))
        .collect();
    Regex::new(&format!("(?-u){}", alternation.join("|"))).expect("token patterns are valid")
});

static CONTEXTS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    CONTEXT_PATTERNS
        .iter()
        .map(|(_, pattern)| Regex::new(pattern).expect("context patterns are valid"))
        .collect()
});

static KEY_BLOCK_BEGIN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"-----BEGIN [A-Z ]{0,30}PRIVATE KEY(?: BLOCK)?-----").expect("valid")
});

static KEY_BLOCK_END: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"-----END [A-Z ]{0,30}PRIVATE KEY(?: BLOCK)?-----").expect("valid")
});

pub fn token_format_count() -> usize {
    TOKEN_PATTERNS.len() + CONTEXT_PATTERNS.len() + 1
}

fn is_token_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'+' | b'/' | b'=' | b'.' | b'~' | b'%')
}

/// End of the contiguous token that starts inside the match ending at `end`.
fn extend_over_token(text: &str, end: usize) -> usize {
    let bytes = text.as_bytes();
    let limit = (end + MAX_TOKEN_EXTENSION).min(bytes.len());
    let mut cursor = end;
    while cursor < limit && is_token_byte(bytes[cursor]) {
        cursor += 1;
    }
    cursor
}

/// Replaces every match (or its `s` group) with the mask, extended over the rest of the token.
fn mask_matches<'t>(text: &'t str, regex: &Regex, group: bool) -> Cow<'t, str> {
    let mut out: Option<String> = None;
    let mut cursor = 0;
    for caps in regex.captures_iter(text) {
        let Some(range) = (if group { caps.name("s") } else { caps.get(0) }) else {
            continue;
        };
        if range.start() < cursor {
            continue;
        }
        let end = extend_over_token(text, range.end());
        let buffer = out.get_or_insert_with(|| String::with_capacity(text.len()));
        buffer.push_str(&text[cursor..range.start()]);
        buffer.push_str(MASK);
        cursor = end;
    }
    match out {
        Some(mut buffer) => {
            buffer.push_str(&text[cursor..]);
            Cow::Owned(buffer)
        }
        None => Cow::Borrowed(text),
    }
}

/// Collapses PEM private key bodies to the mask. `in_block` carries the state across calls.
fn mask_private_key_blocks<'t>(text: &'t str, in_block: &mut bool) -> Cow<'t, str> {
    if !*in_block && !text.contains("PRIVATE KEY") {
        return Cow::Borrowed(text);
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    loop {
        if *in_block {
            let Some(end) = KEY_BLOCK_END.find(rest) else {
                return Cow::Owned(out);
            };
            *in_block = false;
            rest = &rest[end.start()..];
            continue;
        }
        let Some(begin) = KEY_BLOCK_BEGIN.find(rest) else {
            out.push_str(rest);
            return Cow::Owned(out);
        };
        out.push_str(&rest[..begin.end()]);
        out.push_str(MASK);
        rest = &rest[begin.end()..];
        *in_block = true;
    }
}

fn mask_tokens_and_contexts(text: &str) -> Cow<'_, str> {
    let mut current = mask_matches(text, &TOKENS, false);
    for regex in CONTEXTS.iter() {
        if let Cow::Owned(replaced) = mask_matches(&current, regex, true) {
            current = Cow::Owned(replaced);
        }
    }
    current
}

/// Masks every secret in a complete piece of text (Team Wire message, scrollback snapshot).
pub fn redact_text(text: &str) -> String {
    let mut in_block = false;
    let without_keys = mask_private_key_blocks(text, &mut in_block);
    mask_tokens_and_contexts(&without_keys).into_owned()
}

/// Replaces the user's home directory with `~` (presentation mode).
pub fn hide_home_path(text: &str, home: &str) -> String {
    if home.len() < 2 || !text.contains(home) {
        return text.to_string();
    }
    text.replace(home, "~")
}

/// Incremental redactor for a terminal stream.
///
/// The last unfinished line is held back so a secret split across reads is always seen
/// whole. The caller releases held text with `flush` once the stream pauses.
#[derive(Debug, Default)]
pub struct StreamRedactor {
    carry: String,
    in_key_block: bool,
}

impl StreamRedactor {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn has_pending(&self) -> bool {
        !self.carry.is_empty()
    }

    fn redact_complete(&mut self, text: &str) -> String {
        let without_keys = mask_private_key_blocks(text, &mut self.in_key_block);
        mask_tokens_and_contexts(&without_keys).into_owned()
    }

    /// Feeds a chunk and returns the text that is safe to display now.
    pub fn push(&mut self, chunk: &str) -> String {
        let mut buffer = std::mem::take(&mut self.carry);
        buffer.push_str(chunk);

        let line_end = buffer.rfind('\n').map(|i| i + 1).unwrap_or(0);
        let mut hold_from = line_end;
        if buffer.len() - line_end > MAX_HELD_LINE {
            // Oversized line: only the trailing token can still be an unfinished secret.
            let bytes = buffer.as_bytes();
            let floor = buffer.len() - MAX_HELD_TOKEN;
            let mut start = buffer.len();
            while start > floor && is_token_byte(bytes[start - 1]) {
                start -= 1;
            }
            hold_from = start;
        }

        self.carry = buffer.split_off(hold_from);
        if buffer.is_empty() {
            return String::new();
        }
        self.redact_complete(&buffer)
    }

    /// Releases whatever is still held back (called once the stream pauses or ends).
    pub fn flush(&mut self) -> String {
        if self.carry.is_empty() {
            return String::new();
        }
        let held = std::mem::take(&mut self.carry);
        self.redact_complete(&held)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    const LOWER_HEX: &str = "0123456789abcdef";
    const UPPER_NUM: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const ALNUM: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    /// Deterministic filler so no secret-shaped literal ever sits in the source tree.
    fn body(len: usize, alphabet: &str, seed: usize) -> String {
        let chars: Vec<char> = alphabet.chars().collect();
        (0..len)
            .map(|i| chars[(seed * 31 + i * 17 + (i * i) % 7) % chars.len()])
            .collect()
    }

    pub struct Sample {
        pub name: &'static str,
        pub line: String,
        pub secret: String,
    }

    fn token(name: &'static str, secret: String) -> Sample {
        Sample {
            name,
            line: format!("export VALUE={secret} # {name}"),
            secret,
        }
    }

    fn context(name: &'static str, prefix: &str, secret: String, suffix: &str) -> Sample {
        Sample {
            name,
            line: format!("{prefix}{secret}{suffix}"),
            secret,
        }
    }

    /// One sample per supported secret format (kept in sync with the pattern tables).
    pub fn samples() -> Vec<Sample> {
        let mut seed = 0;
        let mut next = |len: usize, alphabet: &str| {
            seed += 1;
            body(len, alphabet, seed)
        };
        vec![
            token("anthropic", format!("sk-ant-{}", next(95, ALNUM))),
            token("openai-project", format!("sk-proj-{}", next(48, ALNUM))),
            token("openai-service-account", format!("sk-svcacct-{}", next(48, ALNUM))),
            token("openrouter", format!("sk-or-v1-{}", next(64, LOWER_HEX))),
            token("openai-legacy", format!("sk-{}", next(48, ALNUM))),
            token("github-pat", format!("ghp_{}", next(36, ALNUM))),
            token("github-oauth", format!("gho_{}", next(36, ALNUM))),
            token("github-app-server", format!("ghs_{}", next(36, ALNUM))),
            token("github-fine-grained", format!("github_pat_{}", next(82, ALNUM))),
            token("gitlab-pat", format!("glpat-{}", next(20, ALNUM))),
            token("aws-access-key-id", format!("AKIA{}", next(16, UPPER_NUM))),
            token("aws-session-key-id", format!("ASIA{}", next(16, UPPER_NUM))),
            token("google-api-key", format!("AIza{}", next(35, ALNUM))),
            token("google-oauth-token", format!("ya29.{}", next(120, ALNUM))),
            token("google-oauth-secret", format!("GOCSPX-{}", next(28, ALNUM))),
            token(
                "firebase-fcm",
                format!("AAAA{}:APA91b{}", next(7, ALNUM), next(134, ALNUM)),
            ),
            token(
                "slack-bot-token",
                format!("xoxb-{}-{}", next(12, "0123456789"), next(24, ALNUM)),
            ),
            token(
                "slack-user-token",
                format!("xoxp-{}-{}", next(12, "0123456789"), next(32, ALNUM)),
            ),
            token(
                "slack-webhook",
                format!(
                    "https://hooks.slack.com/services/T{}/B{}/{}",
                    next(9, UPPER_NUM),
                    next(9, UPPER_NUM),
                    next(24, ALNUM)
                ),
            ),
            token("stripe-secret-live", format!("sk_live_{}", next(24, ALNUM))),
            token("stripe-secret-test", format!("sk_test_{}", next(24, ALNUM))),
            token("stripe-restricted", format!("rk_live_{}", next(24, ALNUM))),
            token("stripe-webhook", format!("whsec_{}", next(32, ALNUM))),
            token("twilio-api-key", format!("SK{}", next(32, LOWER_HEX))),
            token("twilio-account-sid", format!("AC{}", next(32, LOWER_HEX))),
            token(
                "sendgrid",
                format!("SG.{}.{}", next(22, ALNUM), next(43, ALNUM)),
            ),
            token("npm", format!("npm_{}", next(36, ALNUM))),
            token("pypi", format!("pypi-AgEIcHlwaS5vcmc{}", next(70, ALNUM))),
            token("huggingface", format!("hf_{}", next(34, ALNUM))),
            token(
                "jwt",
                format!(
                    "eyJ{}.eyJ{}.{}",
                    next(33, ALNUM),
                    next(5000, ALNUM),
                    next(43, ALNUM)
                ),
            ),
            token("mapbox-secret", format!("sk.eyJ{}.{}", next(60, ALNUM), next(22, ALNUM))),
            token("digitalocean", format!("dop_v1_{}", next(64, LOWER_HEX))),
            token("shopify", format!("shpat_{}", next(32, LOWER_HEX))),
            token("linear", format!("lin_api_{}", next(40, ALNUM))),
            token("notion-legacy", format!("secret_{}", next(43, ALNUM))),
            token("notion", format!("ntn_{}", next(46, ALNUM))),
            token(
                "discord-bot",
                format!("M{}.{}.{}", next(23, ALNUM), next(6, ALNUM), next(27, ALNUM)),
            ),
            token(
                "telegram-bot",
                format!("{}:AA{}", next(10, "123456789"), next(33, ALNUM)),
            ),
            token("mailgun", format!("key-{}", next(32, LOWER_HEX))),
            token("mailchimp", format!("{}-us14", next(32, LOWER_HEX))),
            token("square", format!("sq0atp-{}", next(22, ALNUM))),
            token("supabase-pat", format!("sbp_{}", next(40, LOWER_HEX))),
            token("supabase-secret", format!("sb_secret_{}", next(31, ALNUM))),
            token("groq", format!("gsk_{}", next(52, ALNUM))),
            token("xai", format!("xai-{}", next(80, ALNUM))),
            token("replicate", format!("r8_{}", next(37, ALNUM))),
            token("perplexity", format!("pplx-{}", next(48, ALNUM))),
            token("databricks", format!("dapi{}", next(32, LOWER_HEX))),
            token("doppler", format!("dp.pt.{}", next(43, ALNUM))),
            token(
                "postman",
                format!("PMAK-{}-{}", next(24, LOWER_HEX), next(34, LOWER_HEX)),
            ),
            token("sentry", format!("sntrys_{}", next(120, ALNUM))),
            token("newrelic", format!("NRAK-{}", next(27, UPPER_NUM))),
            token("figma", format!("figd_{}", next(43, ALNUM))),
            token("age-secret-key", format!("AGE-SECRET-KEY-1{}", next(58, UPPER_NUM))),
            token("vault", format!("hvs.{}", next(90, ALNUM))),
            token(
                "terraform-cloud",
                format!("{}.atlasv1.{}", next(14, ALNUM), next(67, ALNUM)),
            ),
            token("dropbox", format!("sl.{}", next(138, ALNUM))),
            token("atlassian", format!("ATATT3xFfGF0{}", next(180, ALNUM))),
            token("docker-hub", format!("dckr_pat_{}", next(27, ALNUM))),
            token("grafana", format!("glsa_{}", next(41, ALNUM))),
            token("planetscale", format!("pscale_tkn_{}", next(43, ALNUM))),
            token("fly-io", format!("fo1_{}", next(43, ALNUM))),
            token("pulumi", format!("pul-{}", next(40, LOWER_HEX))),
            token(
                "cloudflare-origin-ca",
                format!("v1.0-{}-{}", next(24, LOWER_HEX), next(146, LOWER_HEX)),
            ),
            context("env-assignment", "DATABASE_PASSWORD=", next(20, ALNUM), ""),
            context("env-quoted", "STRIPE_API_KEY=\"", next(28, ALNUM), "\""),
            context("yaml-env", "  CLIENT_SECRET: ", next(32, ALNUM), ""),
            context("json-env", "\"ACCESS_TOKEN\": \"", next(40, ALNUM), "\","),
            context("quoted-assignment", "const password = \"", next(14, ALNUM), "\";"),
            context("cli-flag", "deploy --token ", next(30, ALNUM), " --yes"),
            context(
                "bearer-header",
                "Authorization: Bearer ",
                next(40, ALNUM),
                "",
            ),
            context(
                "basic-header",
                "Authorization: Basic ",
                next(32, ALNUM),
                "",
            ),
            context(
                "postgres-url",
                "postgres://admin:",
                next(18, ALNUM),
                "@db.internal:5432/app",
            ),
            context(
                "mongodb-url",
                "mongodb+srv://svc:",
                next(18, ALNUM),
                "@cluster0.example.net/prod",
            ),
            context(
                "redis-url",
                "redis://default:",
                next(24, ALNUM),
                "@cache.internal:6379",
            ),
            context(
                "https-basic-url",
                "git clone https://deploy:",
                next(20, ALNUM),
                "@git.example.com/repo.git",
            ),
            context(
                "aws-credentials-file",
                "aws_secret_access_key = ",
                next(40, ALNUM),
                "",
            ),
            context(
                "azure-connection-string",
                "DefaultEndpointsProtocol=https;AccountName=acme;AccountKey=",
                next(86, ALNUM),
                "==;EndpointSuffix=core.windows.net",
            ),
        ]
    }

    fn private_key_block() -> (String, String) {
        let secret = body(64, ALNUM, 999);
        let block = format!(
            "-----BEGIN OPENSSH PRIVATE KEY-----\r\n{}\r\n{}\r\n-----END OPENSSH PRIVATE KEY-----\r\n",
            secret,
            body(64, ALNUM, 1000)
        );
        (block, secret)
    }

    #[test]
    fn catalogue_covers_at_least_fifty_formats() {
        let names: std::collections::HashSet<_> = samples().iter().map(|s| s.name).collect();
        assert_eq!(names.len(), samples().len(), "sample names must be unique");
        assert!(names.len() + 1 >= 50, "only {} formats", names.len() + 1);
        assert!(token_format_count() >= 50);
    }

    #[test]
    fn every_format_is_masked_in_complete_text() {
        for sample in samples() {
            let redacted = redact_text(&sample.line);
            assert!(
                !redacted.contains(&sample.secret),
                "{} leaked: {redacted}",
                sample.name
            );
            assert!(redacted.contains(MASK), "{} not masked", sample.name);
        }
    }

    #[test]
    fn no_fragment_of_a_secret_survives() {
        for sample in samples() {
            let redacted = redact_text(&sample.line);
            let tail_start = sample.secret.len().saturating_sub(12);
            assert!(
                !redacted.contains(&sample.secret[tail_start..]),
                "{} leaked its tail: {redacted}",
                sample.name
            );
        }
    }

    #[test]
    fn streaming_never_leaks_at_any_chunk_boundary() {
        for sample in samples() {
            let line = format!("build log line\r\n{}\r\n$ ", sample.line);
            let boundaries: Vec<usize> = (1..line.len())
                .filter(|i| line.is_char_boundary(*i))
                .collect();
            for split in boundaries {
                let mut redactor = StreamRedactor::new();
                let mut out = redactor.push(&line[..split]);
                out.push_str(&redactor.push(&line[split..]));
                out.push_str(&redactor.flush());
                assert!(
                    !out.contains(&sample.secret),
                    "{} leaked when split at {split}: {out}",
                    sample.name
                );
                assert!(out.contains(MASK), "{} unmasked at {split}", sample.name);
                assert!(out.starts_with("build log line\r\n"));
                assert!(out.ends_with("\r\n$ "));
            }
        }
    }

    #[test]
    fn streaming_survives_byte_by_byte_delivery() {
        for sample in samples() {
            let line = format!("{}\n", sample.line);
            let mut redactor = StreamRedactor::new();
            let mut out = String::new();
            for ch in line.chars() {
                out.push_str(&redactor.push(&ch.to_string()));
            }
            out.push_str(&redactor.flush());
            assert!(!out.contains(&sample.secret), "{} leaked", sample.name);
        }
    }

    #[test]
    fn private_key_block_is_masked_across_chunks() {
        let (block, secret) = private_key_block();
        assert!(!redact_text(&block).contains(&secret));

        for split in (1..block.len()).filter(|i| block.is_char_boundary(*i)) {
            let mut redactor = StreamRedactor::new();
            let mut out = redactor.push(&block[..split]);
            out.push_str(&redactor.push(&block[split..]));
            out.push_str(&redactor.flush());
            assert!(!out.contains(&secret), "key leaked when split at {split}");
            assert!(out.contains("-----BEGIN OPENSSH PRIVATE KEY-----"));
            assert!(out.contains("-----END OPENSSH PRIVATE KEY-----"));
            assert_eq!(out.matches(MASK).count(), 1);
        }
    }

    #[test]
    fn single_line_pem_in_json_is_masked() {
        let secret = body(80, ALNUM, 7);
        let json = format!(
            "\"private_key\": \"-----BEGIN PRIVATE KEY-----\\n{secret}\\n-----END PRIVATE KEY-----\\n\","
        );
        let redacted = redact_text(&json);
        assert!(!redacted.contains(&secret));
        assert!(redacted.ends_with("-----END PRIVATE KEY-----\\n\","));
    }

    #[test]
    fn ordinary_output_passes_through_unchanged() {
        let lines = [
            "commit 28a8fc2e4b1d9a7c6f5e4d3c2b1a0f9e8d7c6b5a",
            "request id 3f2504e0-4f89-11d3-9a0c-0305e82c3301 completed in 12ms",
            "  token: string;",
            "const token = await getToken();",
            "password: z.string().min(8),",
            "GET https://example.com/api/v1/users?page=2 200",
            "src/components/terminal/XTermWrapper.tsx:42:7 - error TS2322",
            "\x1b[32m✓\x1b[0m tests/previewStore.test.ts (8 tests) 5ms",
            "export PATH=/opt/homebrew/bin:$PATH",
            "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            "Compiling helmade v0.1.0 (/Users/dev/HelmADE/src-tauri)",
            "MAX_TOKENS=4096",
            "SECRET_KEY_BASE=$RAILS_MASTER",
        ];
        for line in lines {
            assert_eq!(redact_text(line), line, "false positive on: {line}");
        }
    }

    #[test]
    fn non_secret_stream_is_byte_identical_for_any_split() {
        let text = "\x1b[1mação\x1b[0m 🚀 building…\r\nstep 2 of 9\r\nuser@host project % ";
        for split in (1..text.len()).filter(|i| text.is_char_boundary(*i)) {
            let mut redactor = StreamRedactor::new();
            let mut out = redactor.push(&text[..split]);
            out.push_str(&redactor.push(&text[split..]));
            out.push_str(&redactor.flush());
            assert_eq!(out, text, "stream altered when split at {split}");
        }
    }

    #[test]
    fn oversized_line_still_masks_a_trailing_split_token() {
        let secret = format!("ghp_{}", body(36, ALNUM, 3));
        let filler = "x ".repeat(MAX_HELD_LINE);
        let line = format!("{filler}{secret}");
        let split = line.len() - 20;
        let mut redactor = StreamRedactor::new();
        let mut out = redactor.push(&line[..split]);
        assert!(redactor.has_pending());
        out.push_str(&redactor.push(&line[split..]));
        out.push_str(&redactor.flush());
        assert!(!out.contains(&secret));
        assert!(out.contains(MASK));
    }

    #[test]
    fn complete_lines_are_released_immediately() {
        let mut redactor = StreamRedactor::new();
        assert_eq!(redactor.push("ready\r\n"), "ready\r\n");
        assert!(!redactor.has_pending());
        assert_eq!(redactor.push("prompt % "), "");
        assert!(redactor.has_pending());
        assert_eq!(redactor.flush(), "prompt % ");
    }

    #[test]
    fn hide_home_path_replaces_the_home_directory() {
        assert_eq!(
            hide_home_path("/Users/jane/work/app % ls /Users/jane", "/Users/jane"),
            "~/work/app % ls ~"
        );
        assert_eq!(hide_home_path("nothing here", "/Users/jane"), "nothing here");
        assert_eq!(hide_home_path("/x", "/"), "/x");
    }
}
