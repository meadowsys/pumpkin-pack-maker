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
		.filter(f => f.endsWith(".png") && f.startsWith("carved_pumpkin"))
	).then(c => Promise.all(c.map(async carved_png_name => {
		let carved_png_file = path.resolve(`./pumpkins/${carved_png_name}`);
		let carved_base_filename = carved_png_name.substring(0, carved_png_name.length - path.extname(carved_png_name).length);

		let lantern_png_name = `jack_o_lantern${carved_png_name.substring("carved_pumpkin".length)}`;
		let lantern_png_file = path.resolve(`./pumpkins/${lantern_png_name}`);
		let lantern_base_filename = lantern_png_name.substring(0, lantern_png_name.length - path.extname(lantern_png_name).length);

		let weight_name = carved_base_filename + ".weight";
		let weight_file = path.resolve(`./pumpkins/${weight_name}`);
		let weight = await fsp.readFile(weight_file, "utf8")
			.catch(() => "NaN")
			.then(n => Number.parseInt(n.trim()));

		return {
			carved_pumpkin: {
				filename: carved_png_name,
				base_filename: carved_base_filename,
				fs_path: carved_png_file
			},
			jack_o_lantern: {
				filename: lantern_png_name,
				base_filename: lantern_base_filename,
				fs_path: lantern_png_file
			},
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

/** @type {Array<{ model: string, weight?: number }>} */
let carved_models = [];
/** @type {Array<{ model: string, weight?: number }>} */
let lantern_models = [];

for (let pumpkin of contents) {
	// copy the texture
	let carved_out_image_path = path.resolve(
		out_dir,
		"./assets/minecraft/textures/block",
		pumpkin.carved_pumpkin.filename
	);
	await fsp.mkdir(path.dirname(carved_out_image_path), { recursive: true });
	await fsp.link(pumpkin.carved_pumpkin.fs_path, carved_out_image_path);

	let lantern_out_image_path = path.resolve(
		out_dir,
		"./assets/minecraft/textures/block",
		pumpkin.jack_o_lantern.filename
	);
	await fsp.mkdir(path.dirname(lantern_out_image_path), { recursive: true });
	await fsp.link(pumpkin.jack_o_lantern.fs_path, lantern_out_image_path);

	// generate/write the model
	let carved_model = {
		parent: "minecraft:block/orientable",
		textures: {
			top: "minecraft:block/pumpkin_top",
			front: `minecraft:block/${pumpkin.carved_pumpkin.base_filename}`,
			side: "minecraft:block/pumpkin_side"
		}
	};

	let carved_out_model_path = path.resolve(
		out_dir,
		"./assets/minecraft/models/block",
		pumpkin.carved_pumpkin.base_filename + ".json"
	);
	await fsp.mkdir(path.dirname(carved_out_model_path), { recursive: true });
	await write_string_to_file(carved_out_model_path, carved_model);

	let lantern_model = {
		parent: "minecraft:block/orientable",
		textures: {
			top: "minecraft:block/pumpkin_top",
			front: `minecraft:block/${pumpkin.jack_o_lantern.base_filename}`,
			side: "minecraft:block/pumpkin_side"
		}
	};

	let lantern_out_model_path = path.resolve(
		out_dir,
		"./assets/minecraft/models/block",
		pumpkin.jack_o_lantern.base_filename + ".json"
	)
	await fsp.mkdir(path.dirname(lantern_out_model_path), { recursive: true });
	await write_string_to_file(lantern_out_model_path, lantern_model);

	// generate/store the model for blockstate
	carved_models.push({
		model: `minecraft:block/${pumpkin.carved_pumpkin.base_filename}`,
		weight: pumpkin.meta.weight
	});
	lantern_models.push({
		model: `minecraft:block/${pumpkin.jack_o_lantern.base_filename}`,
		weight: pumpkin.meta.weight
	});
}

// generate/write blockstate
let carved_blockstate = {
	variants: {
		"facing=north": carved_models.map(blockstate_mapper()),
		"facing=east": carved_models.map(blockstate_mapper(90)),
		"facing=south": carved_models.map(blockstate_mapper(180)),
		"facing=west": carved_models.map(blockstate_mapper(270))
	}
};
let lantern_blockstate = {
	variants: {
		"facing=north": lantern_models.map(blockstate_mapper()),
		"facing=east": lantern_models.map(blockstate_mapper(90)),
		"facing=south": lantern_models.map(blockstate_mapper(180)),
		"facing=west": lantern_models.map(blockstate_mapper(270))
	}
};

let carved_blockstate_file = path.resolve(
	out_dir,
	"./assets/minecraft/blockstates/carved_pumpkin.json"
);
await write_string_to_file(carved_blockstate_file, carved_blockstate);
let lantern_blockstate_file = path.resolve(
	out_dir,
	"./assets/minecraft/blockstates/jack_o_lantern.json"
);
await write_string_to_file(lantern_blockstate_file, lantern_blockstate);

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
		let json = {};

		json.model = m.model;
		if (y) json.y = y;
		if (m.weight) json.weight = m.weight;

		return json;
	};
}
