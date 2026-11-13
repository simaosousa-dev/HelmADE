use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Lista padrão de diretórios pesados de dependências e builds para ligar por symlink
pub const DEFAULT_DEPENDENCY_DIRS: &[&str] = &["node_modules", ".venv", "target", ".cargo"];

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SymlinkEntry {
    pub name: String,
    pub source: String,
    pub target: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Cria um link simbólico de diretório de forma compatível com a plataforma
fn create_dir_symlink(source: &Path, target: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(source, target)
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(source, target)
    }
    #[cfg(not(any(unix, windows)))]
    {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Links simbólicos não suportados nesta plataforma",
        ))
    }
}

/// `true` when git ignores `name` at the repository root (only ignored directories are shared).
fn is_git_ignored(repo_root: &Path, name: &str) -> bool {
    std::process::Command::new("git")
        .current_dir(repo_root)
        .args(["check-ignore", "--quiet", name])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn entry(name: &str, source: &Path, target: &Path, error: Option<String>) -> SymlinkEntry {
    SymlinkEntry {
        name: name.to_string(),
        source: source.to_string_lossy().to_string(),
        target: target.to_string_lossy().to_string(),
        success: error.is_none(),
        error,
    }
}

/// Links the repository's heavy, git-ignored dependency directories into the worktree.
/// A tracked directory is never replaced: the worktree already has its own copy.
pub fn link_dependencies(repo_root: &Path, worktree_dir: &Path) -> Result<Vec<SymlinkEntry>, String> {
    if !repo_root.exists() {
        return Err("O diretório raiz do projeto não existe".to_string());
    }
    if !worktree_dir.exists() {
        return Err("O diretório do worktree não existe".to_string());
    }
    if repo_root == worktree_dir {
        return Err("O diretório raiz e o worktree não podem ser idênticos".to_string());
    }

    let mut results = Vec::new();
    for dir_name in DEFAULT_DEPENDENCY_DIRS {
        let source_path: PathBuf = repo_root.join(dir_name);
        if !source_path.is_dir() || !is_git_ignored(repo_root, dir_name) {
            continue;
        }
        let target_path: PathBuf = worktree_dir.join(dir_name);

        if target_path.is_symlink() {
            if fs::read_link(&target_path).is_ok_and(|dest| dest == source_path) {
                results.push(entry(dir_name, &source_path, &target_path, None));
                continue;
            }
            // Stale link from a previous run: replace it.
            if let Err(err) = fs::remove_file(&target_path) {
                results.push(entry(dir_name, &source_path, &target_path, Some(err.to_string())));
                continue;
            }
        } else if target_path.exists() {
            results.push(entry(
                dir_name,
                &source_path,
                &target_path,
                Some("O destino já existe e não é um link simbólico".to_string()),
            ));
            continue;
        }

        let outcome = create_dir_symlink(&source_path, &target_path)
            .err()
            .map(|err| err.to_string());
        results.push(entry(dir_name, &source_path, &target_path, outcome));
    }

    // A symlink is a file to git, so a `node_modules/` ignore rule does not cover it.
    let linked: Vec<String> = results
        .iter()
        .filter(|e| e.success)
        .map(|e| format!("/{}", e.name))
        .collect();
    if !linked.is_empty() {
        super::ensure_local_excludes(repo_root, &linked)?;
    }

    Ok(results)
}

/// Removes the dependency symlinks from a worktree. Only symlinks are touched, so the
/// directories in the main checkout can never be deleted through this path.
pub fn unlink_dependencies(worktree_dir: &Path) -> Result<(), String> {
    if !worktree_dir.exists() {
        return Ok(());
    }
    for dir_name in DEFAULT_DEPENDENCY_DIRS {
        let target_path = worktree_dir.join(dir_name);
        if !target_path.is_symlink() {
            continue;
        }
        fs::remove_file(&target_path)
            .map_err(|e| format!("Falha ao remover link de dependências: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::TempRepo;

    #[test]
    fn test_dependency_symlink_lifecycle_in_temp_dir() {
        let repo = TempRepo::new("symlink");
        fs::write(repo.path.join(".gitignore"), "node_modules/\n.venv/\n").expect("gitignore");
        fs::create_dir_all(repo.path.join(".venv")).expect("venv");
        fs::write(repo.path.join(".venv").join("pyvenv.cfg"), "home = /usr/bin").expect("cfg");
        fs::write(repo.path.join("node_modules").join("test-package.txt"), "dummy content 123")
            .expect("pkg");
        let worktree = repo.path.join("wt");
        fs::create_dir_all(&worktree).expect("worktree dir");

        let entries = link_dependencies(&repo.path, &worktree).expect("link");
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().all(|e| e.success));
        assert_eq!(
            fs::read_to_string(worktree.join("node_modules").join("test-package.txt")).expect("read"),
            "dummy content 123"
        );
        assert!(worktree.join(".venv").join("pyvenv.cfg").exists());

        let second_run = link_dependencies(&repo.path, &worktree).expect("idempotent");
        assert_eq!(second_run.len(), 2);
        assert!(second_run.iter().all(|e| e.success));

        unlink_dependencies(&worktree).expect("unlink");
        assert!(!worktree.join("node_modules").exists());
        assert!(!worktree.join(".venv").exists());
        assert!(repo.path.join("node_modules").join("test-package.txt").exists());
        assert!(repo.path.join(".venv").join("pyvenv.cfg").exists());
    }

    #[test]
    fn tracked_directories_are_never_linked() {
        let repo = TempRepo::new("symlink_tracked");
        // `target` exists but is not ignored, so it must be left alone.
        fs::create_dir_all(repo.path.join("target")).expect("target");
        fs::write(repo.path.join("target").join("keep.txt"), "tracked").expect("file");
        let worktree = repo.path.join("wt");
        fs::create_dir_all(&worktree).expect("worktree dir");

        let entries = link_dependencies(&repo.path, &worktree).expect("link");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "node_modules");
        assert!(!worktree.join("target").exists());
    }

    #[test]
    fn an_existing_real_directory_is_reported_not_replaced() {
        let repo = TempRepo::new("symlink_real");
        let worktree = repo.path.join("wt");
        fs::create_dir_all(worktree.join("node_modules")).expect("real dir");
        fs::write(worktree.join("node_modules").join("own.txt"), "mine").expect("file");

        let entries = link_dependencies(&repo.path, &worktree).expect("link");
        assert_eq!(entries.len(), 1);
        assert!(!entries[0].success);
        assert!(worktree.join("node_modules").join("own.txt").exists());
    }
}
