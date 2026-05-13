require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ================= COMMAND =================

const commands = [
  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("DM all members in a role")
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("Select role")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("count")
        .setDescription("How many times send")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Message")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON()
];

// ================= READY =================

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered");
  } catch (err) {
    console.log(err);
  }
});

// ================= INTERACTION =================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "dm") {

    const role = interaction.options.getRole("role");
    const count = interaction.options.getInteger("count");
    const msg = interaction.options.getString("message");

    await interaction.reply({
      content: `📨 Sending DMs to members with role ${role.name}...`,
      ephemeral: true
    });

    // FETCH ALL MEMBERS
    await interaction.guild.members.fetch();

    const members = interaction.guild.members.cache.filter(member =>
      member.roles.cache.has(role.id) && !member.user.bot
    );

    let success = 0;
    let failed = 0;

    for (const [id, member] of members) {

      try {

        for (let i = 0; i < count; i++) {

          await member.send({
            content: `👋 Hello ${member}

${msg}`
          });

        }

        success++;

        console.log(`✅ Sent DM to ${member.user.tag}`);

      } catch (err) {

        failed++;

        console.log(`❌ Failed DM to ${member.user.tag}`);
      }
    }

    await interaction.followUp({
      content:
`✅ DM Sending Completed

👥 Total Members: ${members.size}
✅ Success: ${success}
❌ Failed: ${failed}`,
      ephemeral: true
    });
  }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);
