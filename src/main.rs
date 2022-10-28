use std::io;
use std::fs;
use std::path;

fn main() {
	let dir = get_pumpkin_dir();

	use I1::*;
	match initial_scan(&dir) {
		IsNotDir => {
			println!("error: the path {} is not a directory", dir.display());
		}
		NotExist => {
			fs::create_dir(&dir).unwrap();
			println!("created dir at {}, fill it with le pumpkins", dir.display());
		}
		FSError(e) => {
			println!("fs error: {e}");
		}
		IsDir => {
			println!("ok we are set to go");
		}
	}
}

fn initial_scan(dir: &path::PathBuf) -> I1 {
	let metadata = fs::metadata(dir);
	match metadata {
		Ok(meta) => {
			if meta.is_dir() {
				let contents = fs::read_dir(dir).unwrap();

				let mut png = Vec::new();
				let mut weight = Vec::new();

				contents.for_each(|f| {
					let f = f.unwrap();
					let path = &f.path();

					let extension = path::Path::new(path).extension();
					let extension = match extension {
						Some(v) => { v }
						None => { return }
					};

					if extension.eq_ignore_ascii_case("png") {
						png.push(path::PathBuf::from(f.file_name()))
					} else if extension.eq_ignore_ascii_case("weight") {
						weight.push(path::PathBuf::from(f.file_name()))
					}
				});

				let pumpkins = png.into_iter().map(|f| {
					let filename_without_ext = path::Path::new(&f).file_stem().unwrap();

					let mut filename_weight = path::PathBuf::from(filename_without_ext);
					filename_weight.set_extension("weight");
					let mut filename_weight_fullpath = path::PathBuf::from(&dir);
					filename_weight_fullpath.push(&filename_weight);

					let has_weight = weight.contains(&filename_weight);
					Pumpkin {
						image: f,
						meta: if has_weight {
							Some(PumpkinMeta {
								weight: fs::read_to_string(filename_weight_fullpath)
									.unwrap()
									.trim()
									.parse()
									.unwrap()
							})
						} else {
							None
						}
					}
				}).collect::<Vec<_>>();

				println!("{pumpkins:?}");
				I1::IsDir
			} else {
				I1::IsNotDir
			}
		}
		Err(e) if e.kind() == io::ErrorKind::NotFound => { I1::NotExist }
		Err(e) => { I1::FSError(e) }
	}
}

enum I1 {
	// IsDir(Vec<Pumpkin>),
	IsDir,
	IsNotDir,
	NotExist,
	FSError(io::Error)
}

#[derive(Debug)]
struct Pumpkin {
	image: path::PathBuf,
	meta: Option<PumpkinMeta>
}

#[derive(Debug)]
struct PumpkinMeta {
	weight: usize
}

fn get_pumpkin_dir() -> path::PathBuf {
	let mut dir = std::env::current_dir().expect("unable to get cwd");
	dir.push("pumpkins");
	dir
}
