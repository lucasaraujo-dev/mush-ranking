use std::{
  collections::HashMap,
  env,
  path::PathBuf,
  sync::Arc,
  time::{Duration, SystemTime},
};

use tauri::{AppHandle, Emitter};
use tokio::{
  fs::File,
  io::{AsyncBufReadExt, AsyncReadExt, AsyncSeekExt, BufReader, SeekFrom},
  sync::Mutex,
  time::sleep,
};

const MINECRAFT_REFRESH_TRIGGER_EVENT: &str = "minecraft-refresh-trigger";

#[derive(Default)]
struct LogWatcherState {
  watching: bool,
}

fn default_minecraft_log_path() -> Option<PathBuf> {
  let user_profile = env::var("USERPROFILE").ok()?;
  Some(PathBuf::from(user_profile).join(".minecraft").join("logs").join("latest.log"))
}

fn known_minecraft_log_paths() -> Vec<PathBuf> {
  let os = env::consts::OS;
  let home = env::var("HOME").ok();
  let user_profile = env::var("USERPROFILE").ok();
  let mut paths = Vec::new();

  if let Some(default_path) = default_minecraft_log_path() {
    paths.push(default_path.clone());
    paths.push(default_path.with_file_name("main.log"));
  }

  match os {
    "windows" => {
      if let Some(profile) = user_profile {
        let base = PathBuf::from(profile.replace('\\', "/"));

        paths.push(base.join(".lunarclient").join("profiles").join("lunar").join("1.8").join("logs").join("latest.log"));
        paths.push(base.join(".lunarclient").join("offline").join("multiver").join("logs").join("latest.log"));
        paths.push(base.join("AppData").join("Roaming").join(".tlauncher").join("legacy").join("Minecraft").join("game").join("logs").join("latest.log"));
        paths.push(base.join("AppData").join("Roaming").join("CheatBreaker").join("downloads").join("logs").join("1.8.9").join("latest.log"));
        paths.push(base.join("AppData").join("Roaming").join(".Salwyrr").join("logs").join("latest.log"));
        paths.push(base.join(".cubewhy").join("lunarcn").join("game").join("logs").join("latest.log"));
        paths.push(base.join("AppData").join("Local").join("Programs").join("cmlauncher").join("logs").join("latest.log"));
        paths.push(base.join("silentclient").join("logs").join("main.log"));
        paths.push(base.join("owlclient").join("logs").join("latest.log"));
      }
    }
    "linux" => {
      if let Some(home_dir) = home {
        let base = PathBuf::from(home_dir);
        paths.push(base.join(".minecraft").join("logs").join("latest.log"));
        paths.push(base.join(".lunarclient").join("profiles").join("lunar").join("1.8").join("logs").join("latest.log"));
        paths.push(base.join(".lunarclient").join("offline").join("multiver").join("logs").join("latest.log"));
        paths.push(base.join(".tlauncher").join("legacy").join("Minecraft").join("game").join("logs").join("latest.log"));
        paths.push(base.join(".cheatbreaker").join("downloads").join("logs").join("1.8.9").join("latest.log"));
        paths.push(base.join(".Salwyrr").join("logs").join("latest.log"));
        paths.push(base.join(".cubewhy").join("lunarcn").join("game").join("logs").join("latest.log"));
        paths.push(base.join("silentclient").join("logs").join("main.log"));
        paths.push(base.join("owlclient").join("logs").join("latest.log"));
      }
    }
    "macos" => {
      if let Some(home_dir) = home {
        let base = PathBuf::from(home_dir);
        paths.push(base.join("Library").join("Application Support").join("minecraft").join("logs").join("latest.log"));
        paths.push(base.join(".lunarclient").join("profiles").join("lunar").join("1.8").join("logs").join("latest.log"));
        paths.push(base.join(".lunarclient").join("offline").join("multiver").join("logs").join("latest.log"));
        paths.push(base.join(".tlauncher").join("legacy").join("Minecraft").join("game").join("logs").join("latest.log"));
        paths.push(base.join(".cheatbreaker").join("downloads").join("logs").join("1.8.9").join("latest.log"));
        paths.push(base.join(".Salwyrr").join("logs").join("latest.log"));
        paths.push(base.join(".cubewhy").join("lunarcn").join("game").join("logs").join("latest.log"));
        paths.push(base.join("silentclient").join("logs").join("main.log"));
        paths.push(base.join("owlclient").join("logs").join("latest.log"));
      }
    }
    _ => {}
  }

  let owl_launcher_dir = paths
    .iter()
    .find_map(|path| {
      let candidate = path.parent()?.parent()?.parent()?;
      if candidate.ends_with("owlclient") {
        Some(candidate.join("logs").join("launcher"))
      } else {
        None
      }
    });

  if let Some(launcher_dir) = owl_launcher_dir {
    if launcher_dir.exists() {
      if let Ok(entries) = std::fs::read_dir(launcher_dir) {
        let mut newest_log: Option<(SystemTime, PathBuf)> = None;

        for entry in entries.flatten() {
          let path = entry.path();
          let modified = entry
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .unwrap_or(SystemTime::UNIX_EPOCH);

          if newest_log
            .as_ref()
            .map(|(current_modified, _)| modified > *current_modified)
            .unwrap_or(true)
          {
            newest_log = Some((modified, path));
          }
        }

        if let Some((_, path)) = newest_log {
          paths.push(path);
        }
      }
    }
  }

  let mut deduplicated = Vec::new();

  for path in paths {
    if !deduplicated.contains(&path) {
      deduplicated.push(path);
    }
  }

  deduplicated
}

async fn read_new_lines(
  path: &PathBuf,
  offset: &mut u64,
) -> Result<Vec<String>, std::io::Error> {
  let mut file = File::open(path).await?;
  let metadata = file.metadata().await?;
  let file_len = metadata.len();

  if file_len < *offset {
    *offset = 0;
  }

  file.seek(SeekFrom::Start(*offset)).await?;

  let mut buffer = Vec::new();
  file.read_to_end(&mut buffer).await?;
  *offset = file_len;

  if buffer.is_empty() {
    return Ok(Vec::new());
  }

  let mut lines = Vec::new();
  let reader = BufReader::new(buffer.as_slice());
  let mut stream = reader.lines();

  while let Some(line) = stream.next_line().await? {
    lines.push(line);
  }

  Ok(lines)
}

async fn spawn_log_watcher(app: AppHandle) {
  let mut offsets = HashMap::<PathBuf, u64>::new();

  loop {
    let known_paths = known_minecraft_log_paths();

    for path in known_paths {
      let offset = offsets.entry(path.clone()).or_insert(0);

      if path.exists() {
        match read_new_lines(&path, offset).await {
          Ok(lines) => {
            for line in lines {
              if line.contains("/atualizar") {
                let _ = app.emit(MINECRAFT_REFRESH_TRIGGER_EVENT, true);
              }
            }
          }
          Err(_) => {
            sleep(Duration::from_millis(250)).await;
          }
        }
      } else {
        *offset = 0;
      }
    }

    sleep(Duration::from_millis(350)).await;
  }
}

#[tauri::command]
async fn ensure_log_watcher(
  app: AppHandle,
  watcher_state: tauri::State<'_, Arc<Mutex<LogWatcherState>>>,
) -> Result<(), ()> {
  let mut state = watcher_state.lock().await;

  if state.watching {
    return Ok(());
  }

  state.watching = true;
  drop(state);

  tauri::async_runtime::spawn(spawn_log_watcher(app));
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(Arc::new(Mutex::new(LogWatcherState::default())))
    .invoke_handler(tauri::generate_handler![ensure_log_watcher])
    .run(tauri::generate_context!())
    .expect("failed to run Mush Ranking application");
}
