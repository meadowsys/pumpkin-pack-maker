// @ts-check

import fsp from "fs/promises";
import path from "path";

const pumpkins_dir = path.resolve("./pumpkins");
const out_dir = path.resolve("./out");

let pumpkins_dir_metadata = await fsp.stat(pumpkins_dir).catch(async () => {
	await fsp.mkdir(pumpkins_dir, { recursive: true });
	console.log(`created dir at ${pumpkins_dir}, fill it with le pumpkins`);
	process.exit(1);
});

if (!pumpkins_dir_metadata.isDirectory()) {
	console.log(`error: the path ${pumpkins_dir} is not a directory`);
	process.exit(1);
}

const contents = await fsp.readdir(pumpkins_dir, { withFileTypes: true })
	.then(contents => contents
		.filter(f => f.isFile())
		.map(f => f.name)
		.filter(f => f.endsWith(".png"))
	).then(contents => Promise.all(contents.map(async png_name => {
		let png_file = path.resolve(`./pumpkins/${png_name}`);
		let base_filename = png_name.substring(0, png_name.length - path.extname(png_name).length);
		let weight_name = base_filename + ".weight";

		let weight_file = path.resolve(`./pumpkins/${weight_name}`);
		let weight = await fsp.readFile(weight_file, "utf8")
			.catch(() => "NaN")
			.then(n => Number.parseInt(n.trim()));

		return {
			fs_source_path: png_file,
			filename: png_name,
			base_filename,
			meta: {
				weight: Number.isNaN(weight) ? undefined : weight
			}
		};
	})));

await fsp.rm(out_dir, { recursive: true, force: true });

await write_string_to_file(path.resolve(out_dir, "./pack.mcmeta"), {
	pack: {
		pack_format: 9,
		description: "This content was generated\nby Grumbot™"
	}
});

/**
 * @type {Array<{ model: string, weight?: number }>} */
let models = [];

for (let pumpkin of contents) {
	// copy the texture
	let out_image_path = path.resolve(
		out_dir,
		"./assets/minecraft/textures/block",
		pumpkin.filename
	);
	await fsp.mkdir(path.dirname(out_image_path), { recursive: true });
	await fsp.link(pumpkin.fs_source_path, out_image_path);

	// generate/write the model
	let model = {
		parent: "minecraft:block/orientable",
		textures: {
			top: "minecraft:block/pumpkin_top",
			front: `minecraft:block/${pumpkin.base_filename}`,
			side: "minecraft:block/pumpkin_side"
		}
	};

	let out_model_path = path.resolve(
		out_dir,
		"./assets/minecraft/models/block",
		pumpkin.base_filename + ".json"
	);
	await fsp.mkdir(path.dirname(out_model_path), { recursive: true });
	await write_string_to_file(out_model_path, model);

	// generate/store the model for blockstate
	models.push({
		model: `minecraft:block/${pumpkin.base_filename}`,
		weight: pumpkin.meta.weight
	});
}

// generate/write blockstate
let blockstate = `
{
  "variants": {
    "facing=north": [
      ${models.map(blockstate_mapper()).join(",\n      ")}
    ],
    "facing=east": [
      ${models.map(blockstate_mapper(90)).join(",\n      ")}
    ],
    "facing=south": [
      ${models.map(blockstate_mapper(180)).join(",\n      ")}
    ],
    "facing=west": [
      ${models.map(blockstate_mapper(270)).join(",\n      ")}
    ]
  }
}
`.trim() + "\n";

let blockstate_file = path.resolve(
	out_dir,
	"./assets/minecraft/blockstates/carved_pumpkin.json"
);
await write_string_to_file(blockstate_file, blockstate);

/**
 * @param {string} filename
 * @param {string | object} contents
 */
async function write_string_to_file(filename, contents) {
	if (typeof contents !== "string") contents = JSON.stringify(contents, null, "  ");
	await fsp.mkdir(path.dirname(filename), { recursive: true });
	return await fsp.writeFile(filename, contents.trim() + "\n");
}

/**
 * @param {number | undefined} y
 */
function blockstate_mapper(y = undefined) {
	/**
	 * @param {{ model: string, weight?: number }} m
	 */
	return m => {
		let json = "";

		if (y) json += `, "y": ${y}`;
		if (m.weight) json += `, "weight": ${m.weight}`;
		json += `, "model":" ${m.model}"`;

		json = `{ ${json.substring(2)} }`;
		return json;
	};
}
