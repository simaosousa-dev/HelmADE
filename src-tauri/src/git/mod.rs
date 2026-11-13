pub mod diff;
pub mod symlink;
pub mod worktree;

use std::ffi::OsStr;
use std::path::Path;
use std::process::Command;

/// Longest identifier accepted for swarms, panels and worktrees.
pub const MAX_ID_LEN: usize = 64;

/// Validates an identifier that ends up in a branch name and a directory name.
/// Rejects instead of silently rewriting, so two different inputs can never collide.
pub fn validate_id(id: &str) -> Result<&str, String> {
    let valid = !id.is_empty()
        && id.len() <= MAX_ID_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !valid {
        return Err("Identificador inválido: usa apenas letras, números, '-' e '_'".to_string());
    }
    Ok(id)
}

/// Validates a branch name received from the frontend before it reaches a git command line.
pub fn validate_branch(name: &str) -> Result<&str, String> {
    let valid = !name.is_empty()
        && name.len() <= 200
        && !name.starts_with('-')
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '/' | '.'));
    if !valid {
        return Err("Nome de branch inválido".to_string());
    }
    Ok(name)
}

/// Returns the repository root as a path, or an error when it is not a git checkout.
pub fn require_repo(repo_path: &str) -> Result<&Path, String> {
    let repo = Path::new(repo_path);
    if !repo.is_dir() || !repo.join(".git").exists() {
        return Err("Este projeto não é um repositório Git".to_string());
    }
    Ok(repo)
}

/// Runs git and returns trimmed stdout, or git's stderr as the error.
pub fn run_git<I, S>(cwd: &Path, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|e| format!("Falha ao executar git: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Branch currently checked out in `repo` (errors on a detached HEAD or an empty repository).
pub fn current_branch(repo: &Path) -> Result<String, String> {
    run_git(repo, ["rev-parse", "--verify", "--quiet", "HEAD"]).map_err(|_| {
        "O repositório ainda não tem commits. Cria um commit inicial antes de lançar um enxame."
            .to_string()
    })?;
    let branch = run_git(repo, ["symbolic-ref", "--quiet", "--short", "HEAD"]).map_err(|_| {
        "O repositório está em HEAD destacado. Faz checkout de uma branch antes de lançar um enxame."
            .to_string()
    })?;
    Ok(branch)
}

/// Adds patterns to the repository's local exclude file (never touches the tracked `.gitignore`).
pub fn ensure_local_excludes(repo: &Path, patterns: &[String]) -> Result<(), String> {
    let common_dir = run_git(repo, ["rev-parse", "--git-common-dir"])?;
    let info_dir = repo.join(common_dir).join("info");
    std::fs::create_dir_all(&info_dir).map_err(|e| format!("Falha ao preparar exclusões: {e}"))?;
    let exclude_path = info_dir.join("exclude");
    let existing = std::fs::read_to_string(&exclude_path).unwrap_or_default();

    let missing: Vec<&String> = patterns
        .iter()
        .filter(|pattern| !existing.lines().any(|line| line.trim() == pattern.as_str()))
        .collect();
    if missing.is_empty() {
        return Ok(());
    }

    let mut updated = existing;
    if !updated.is_empty() && !updated.ends_with('\n') {
        updated.push('\n');
    }
    for pattern in missing {
        updated.push_str(pattern);
        updated.push('\n');
    }
    std::fs::write(&exclude_path, updated).map_err(|e| format!("Falha ao gravar exclusões: {e}"))
}

#[cfg(test)]
pub mod test_support {
    use super::run_git;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    /// Temporary repository with one commit on `main`, an ignored `node_modules` and a `.gitignore`.
    pub struct TempRepo {
        pub path: PathBuf,
    }

    impl TempRepo {
        pub fn new(label: &str) -> Self {
            let unique = format!(
                "helmade_{label}_{}_{}",
                std::process::id(),
                COUNTER.fetch_add(1, Ordering::Relaxed)
            );
            // Canonical path so comparisons survive macOS's /var → /private/var symlink.
            let base = std::env::temp_dir().canonicalize().expect("temp dir");
            let path = base.join(unique);
            fs::create_dir_all(&path).expect("create temp repo");

            run_git(&path, ["init", "--quiet", "--initial-branch=main"]).expect("git init");
            run_git(&path, ["config", "user.name", "HelmADE Test"]).expect("config name");
            run_git(&path, ["config", "user.email", "test@helmade.dev"]).expect("config email");
            run_git(&path, ["config", "commit.gpgsign", "false"]).expect("config gpg");

            fs::write(path.join(".gitignore"), "node_modules/\n").expect("gitignore");
            fs::write(path.join("README.md"), "# Test\nInitial line\n").expect("readme");
            fs::create_dir_all(path.join("node_modules")).expect("node_modules");
            fs::write(path.join("node_modules").join("pkg.json"), "{}").expect("pkg");
            run_git(&path, ["add", "."]).expect("git add");
            run_git(&path, ["commit", "--quiet", "-m", "chore: initial commit"]).expect("commit");
            Self { path }
        }

        pub fn path_str(&self) -> &str {
            self.path.to_str().expect("utf-8 temp path")
        }
    }

    impl Drop for TempRepo {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::TempRepo;
    use super::*;

    #[test]
    fn validate_id_rejects_path_and_shell_characters() {
        assert!(validate_id("swarm-a1_b2").is_ok());
        for bad in ["", "../x", "a/b", "a b", "a;rm", "é", &"x".repeat(65)] {
            assert!(validate_id(bad).is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn validate_branch_rejects_option_injection() {
        assert!(validate_branch("feature/login-v2").is_ok());
        for bad in ["", "--upload-pack=x", "a..b", "a b", "a;b", "a~1"] {
            assert!(validate_branch(bad).is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn current_branch_reports_the_checked_out_branch() {
        let repo = TempRepo::new("branch");
        assert_eq!(current_branch(&repo.path).expect("branch"), "main");
    }

    #[test]
    fn current_branch_explains_an_empty_repository() {
        let repo = TempRepo::new("empty");
        let empty = repo.path.join("nested");
        std::fs::create_dir_all(&empty).expect("dir");
        run_git(&empty, ["init", "--quiet"]).expect("init");
        let err = current_branch(&empty).expect_err("no commits");
        assert!(err.contains("commit inicial"));
    }

    #[test]
    fn local_excludes_are_appended_once() {
        let repo = TempRepo::new("exclude");
        let patterns = vec![".helm/".to_string()];
        ensure_local_excludes(&repo.path, &patterns).expect("first");
        ensure_local_excludes(&repo.path, &patterns).expect("second");
        let content =
            std::fs::read_to_string(repo.path.join(".git/info/exclude")).expect("exclude file");
        assert_eq!(content.matches(".helm/").count(), 1);
    }
}
