require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  REST,
  Routes,
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
} = require("@discordjs/voice");

const ytdlp = require("yt-dlp-exec");
require("ffmpeg-static");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
});

const vcTime = new Map();
const joinTimes = new Map();
const musicData = new Map();

const commands = [
  new SlashCommandBuilder().setName("join").setDescription("Bot joins your voice channel"),
  new SlashCommandBuilder().setName("activity").setDescription("Shows VC activity top 10"),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Send DM to members with a role")
    .addRoleOption(opt => opt.setName("role").setDescription("Role to send DM").setRequired(true))
    .addStringOption(opt => opt.setName("message").setDescription("DM message").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play YouTube music")
    .addStringOption(opt => opt.setName("url").setDescription("YouTube video link").setRequired(true)),

  new SlashCommandBuilder().setName("stop").setDescription("Stop music"),
  new SlashCommandBuilder().setName("pause").setDescription("Pause music"),
  new SlashCommandBuilder().setName("resume").setDescription("Resume music"),
].map(c => c.toJSON());

async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered successfully.");
  } catch (err) {
    console.log("Slash command register error:", err);
  }
}

client.once("clientReady", async () => {
  console.log(`${client.user.tag} is online.`);
  client.user.setActivity("VC Activity & Music");
  await registerCommands();
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;

  if (!oldState.channelId && newState.channelId) {
    joinTimes.set(userId, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    const joinedAt = joinTimes.get(userId);
    if (!joinedAt) return;

    const minutes = Math.floor((Date.now() - joinedAt) / 60000);
    vcTime.set(userId, (vcTime.get(userId) || 0) + minutes);
    joinTimes.delete(userId);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "join") {
    const channel = interaction.member.voice.channel;
    if (!channel) return interaction.reply({ content: "You must join a voice channel first.", ephemeral: true });

    joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    return interaction.reply(`Bot joined: ${channel.name}`);
  }

  if (interaction.commandName === "activity") {
    const sorted = [...vcTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) return interaction.reply("No VC activity data yet.");

    const list = sorted
      .map(([userId, min], i) => `**${i + 1}.** <@${userId}> — ${(min / 60).toFixed(2)}h`)
      .join("\n");

    const embed = new EmbedBuilder().setTitle("VC Activity Top 10").setDescription(list).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "dm") {
    const role = interaction.options.getRole("role");
    const message = interaction.options.getString("message");

    await interaction.deferReply({ ephemeral: true });

    const members = await interaction.guild.members.fetch();
    const targets = members.filter(m => m.roles.cache.has(role.id) && !m.user.bot);

    let success = 0;
    let failed = 0;

    for (const member of targets.values()) {
      try {
        await member.send(message);
        success++;
        await new Promise(r => setTimeout(r, 1200));
      } catch {
        failed++;
      }
    }

    return interaction.editReply(`DM finished\nSuccess: ${success}\nFailed: ${failed}`);
  }

  if (interaction.commandName === "play") {
    const url = interaction.options.getString("url");
    const channel = interaction.member.voice.channel;

    if (!channel) return interaction.reply({ content: "You must join a voice channel first.", ephemeral: true });

    await interaction.deferReply();

    try {
      const oldData = musicData.get(interaction.guild.id);
      if (oldData) {
        try {
          oldData.player.stop();
          oldData.connection.destroy();
        } catch {}
        musicData.delete(interaction.guild.id);
      }

      const info = await ytdlp(url, {
        dumpSingleJson: true,
        noPlaylist: true,
        noWarnings: true,
      });

      const title = info.title || "Unknown Song";

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      const player = createAudioPlayer();

      player.on("error", err => {
        console.log("Audio player error:", err);
      });

      const stream = ytdlp.exec(url, {
        output: "-",
        format: "bestaudio/best",
        noPlaylist: true,
        quiet: true,
      }, {
        stdio: ["ignore", "pipe", "ignore"],
      });

      const resource = createAudioResource(stream.stdout, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });

      resource.volume.setVolume(1.0);

      player.play(resource);
      connection.subscribe(player);

      musicData.set(interaction.guild.id, { player, connection, process: stream });

      player.on(AudioPlayerStatus.Idle, () => {
        try { stream.kill(); } catch {}
        try { connection.destroy(); } catch {}
        musicData.delete(interaction.guild.id);
      });

      return interaction.editReply(`Playing: **${title}**`);
    } catch (err) {
      console.log("Music error:", err);
      return interaction.editReply("Error while playing music.");
    }
  }

  if (interaction.commandName === "stop") {
    const data = musicData.get(interaction.guild.id);
    if (!data) return interaction.reply("No music is currently playing.");

    data.player.stop();
    try { data.process.kill(); } catch {}
    try { data.connection.destroy(); } catch {}
    musicData.delete(interaction.guild.id);

    return interaction.reply("Music stopped.");
  }

  if (interaction.commandName === "pause") {
    const data = musicData.get(interaction.guild.id);
    if (!data) return interaction.reply("No music is currently playing.");

    data.player.pause();
    return interaction.reply("Music paused.");
  }

  if (interaction.commandName === "resume") {
    const data = musicData.get(interaction.guild.id);
    if (!data) return interaction.reply("No music is currently playing.");

    data.player.unpause();
    return interaction.reply("Music resumed.");
  }
});

client.login(process.env.TOKEN);