require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");
const fs = require("fs");

/* ================= CONFIG ================= */

const OWNER_ID = process.env.OWNER_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= DATA ================= */

const DATA_FILE = "/data/data.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(id) {
  if (!data[id]) data[id] = { points: 0, keywordCooldowns: {} };
  if (!data[id].keywordCooldowns) data[id].keywordCooldowns = {};
  return data[id];
}

/* ================= ERROR HANDLER ================= */

process.on("unhandledRejection", error => {
  console.error("UNHANDLED:", error);
});

/* ================= HISTORY ================= */

async function logPoint(guild, userId, amount, reason) {
  const channel = guild.channels.cache.get(process.env.HISTORY_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("📜 Update Poin Ramadhan Fest")
    .setDescription(`👤 <@${userId}>\n➕ +${amount} poin\n📌 ${reason}`)
    .setColor("Gold")
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= GAP BALANCE ================= */

function applyGapBalance(userId, baseReward) {
  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points);

  if (sorted.length < 3) return baseReward;

  const gap = sorted[0][1].points - sorted[2][1].points;
  const rankIndex = sorted.findIndex(e => e[0] === userId);

  if (gap > 1500) {
    if (rankIndex === 0) return Math.floor(baseReward * 0.6);
    if (rankIndex === 1) return Math.floor(baseReward * 0.75);
    if (rankIndex >= 2) return Math.floor(baseReward * 1.4);
  }

  if (gap > 800) {
    if (rankIndex === 0) return Math.floor(baseReward * 0.75);
    if (rankIndex === 1) return Math.floor(baseReward * 0.85);
    if (rankIndex >= 2) return Math.floor(baseReward * 1.2);
  }

  return baseReward;
}

/* ================= LEADERBOARD ================= */

let leaderboardMessage = null;

async function updateLeaderboard(guild) {
  const channel = guild.channels.cache.get(process.env.LEADERBOARD_CHANNEL_ID);
  if (!channel) return;

  const sorted = Object.entries(data)
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 10);

  if (!sorted.length) return;

  const first = sorted[0];
  const second = sorted[1];

  let desc = "";

  desc += `🥇 **CALON JUARA #1**\n<@${first[0]}>\n📊 **${first[1].points} poin**\n`;
  if (second) {
    const gap = first[1].points - second[1].points;
    desc += `📈 Unggul ${gap} poin\n\n`;
    desc += `🥈 **CALON JUARA #2**\n<@${second[0]}>\n📊 **${second[1].points} poin**\n`;
    desc += `📉 Tertinggal ${gap} poin\n\n`;
  }

  desc += `━━━━━━━━━━━━━━━━━━\n`;

  sorted.slice(2).forEach((entry, index) => {
    desc += `**${index + 3}.** <@${entry[0]}> — ${entry[1].points} poin\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 RAMADHAN FEST — LIVE RANKING")
    .setDescription(desc)
    .setColor("Gold")
    .setTimestamp();

const firstUser = await guild.members.fetch(first[0]).catch(() => null);
if (firstUser) {
  embed.setThumbnail(firstUser.user.displayAvatarURL({ dynamic: true }));
}

  if (!leaderboardMessage)
    leaderboardMessage = await channel.send({ embeds: [embed] });
  else
    await leaderboardMessage.edit({ embeds: [embed] });
}

/* ================= KEYWORD ================= */

const keywordCooldown = {
  sahur: 30 * 60 * 1000,
  buka: 30 * 60 * 1000,
  tarawih: 45 * 60 * 1000,
  tadarus: 50 * 60 * 1000,
  sedekah: 60 * 60 * 1000
};

client.on("messageCreate", async message => {

  if (message.author.bot) return;
  if (message.channel.id !== process.env.KEYWORD_CHANNEL_ID) return;

  const content = message.content.toLowerCase().trim();
  if (!keywordCooldown[content]) return;

  const user = getUser(message.author.id);
  const now = Date.now();

  if (now < (user.keywordCooldowns[content] || 0)) {
    const remain = Math.ceil((user.keywordCooldowns[content] - now)/60000);
    return message.reply(`⏳ Tunggu ${remain} menit lagi.`);
  }

  let reward = Math.floor(Math.random()*10)+10;
  reward = applyGapBalance(message.author.id, reward);

  user.points += reward;
  user.keywordCooldowns[content] = now + keywordCooldown[content];

  saveData();
  await updateLeaderboard(message.guild);
  await logPoint(message.guild, message.author.id, reward, "Keyword Ramadhan");

  message.channel.send(`✨ +${reward} poin\n🏆 Total: ${user.points} poin`);
});

/* ================= QUIZ ================= */

let activeQuiz = null;

const questions = [
  { question: "Ibukota Indonesia?", correct: "Jakarta", options: ["Bandung","Jakarta","Medan","Surabaya"] },
  { question: "Jumlah rukun Islam?", correct: "5", options: ["4","5","6","7"] }
];

function shuffle(arr){
  return arr.sort(()=>Math.random()-0.5);
}

async function sendQuiz(guild){

  if(activeQuiz) return;

  const channel = guild.channels.cache.get(process.env.QUIZ_CHANNEL_ID);
  if(!channel) return;

  const q = questions[Math.floor(Math.random()*questions.length)];
  const shuffled = shuffle([...q.options]);
  const correctIndex = shuffled.indexOf(q.correct);

  const embed = new EmbedBuilder()
    .setTitle("🌙 QUIZ RAMADHAN FEST")
    .setDescription(
      `**${q.question}**\n\n`+
      `A. ${shuffled[0]}\n`+
      `B. ${shuffled[1]}\n`+
      `C. ${shuffled[2]}\n`+
      `D. ${shuffled[3]}\n\n⏳ 30 menit`
    )
    .setColor("Gold");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("0").setLabel("A").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("1").setLabel("B").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("2").setLabel("C").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("3").setLabel("D").setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({ embeds:[embed], components:[row] });

  activeQuiz = { correct: correctIndex, answered: [] };

  setTimeout(async ()=>{
    if(!activeQuiz) return;
    await msg.edit({components:[]});
    channel.send("⏰ Waktu habis!");
    activeQuiz=null;
  },30*60*1000);
}

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction => {

  if(interaction.isButton()){
    if(!activeQuiz)
      return interaction.reply({content:"Soal selesai.",ephemeral:true});

    if(activeQuiz.answered.includes(interaction.user.id))
      return interaction.reply({content:"Sudah menjawab.",ephemeral:true});

    activeQuiz.answered.push(interaction.user.id);

    if(parseInt(interaction.customId)===activeQuiz.correct){
      const user=getUser(interaction.user.id);
      let reward=Math.floor(Math.random()*3)+10;
      reward=applyGapBalance(interaction.user.id,reward);
      user.points+=reward;
      saveData();
      await updateLeaderboard(interaction.guild);
      await logPoint(interaction.guild, interaction.user.id, reward, "Quiz");
      return interaction.reply({content:`🔥 Benar! +${reward} poin`,ephemeral:true});
    }

    return interaction.reply({content:"❌ Salah!",ephemeral:true});
  }

  if(!interaction.isChatInputCommand()) return;

  if(interaction.commandName==="cooldown"){
    const user=getUser(interaction.user.id);
    const now=Date.now();
    let text="⏳ Status Cooldown\n\n";

    for(const key in keywordCooldown){
      const cd=user.keywordCooldowns[key]||0;
      if(now>=cd)
        text+=`• ${key}: ✅ Siap\n`;
      else
        text+=`• ${key}: ${Math.ceil((cd-now)/60000)} menit\n`;
    }

    return interaction.reply({content:text,ephemeral:true});
  }

  if(interaction.commandName==="soal"){
    await sendQuiz(interaction.guild);
    return interaction.reply({content:"📢 Quiz dikirim!",ephemeral:true});
  }

  if(interaction.commandName==="addpoin"){
    if(interaction.user.id!==OWNER_ID)
      return interaction.reply({content:"❌ Tidak punya akses.",ephemeral:true});

    const target=interaction.options.getUser("user");
    const jumlah=interaction.options.getInteger("jumlah");

    const user=getUser(target.id);
    user.points+=jumlah;
    saveData();
    await updateLeaderboard(interaction.guild);
    await logPoint(interaction.guild,target.id,jumlah,"Manual Add");

    return interaction.reply({content:"✅ Poin ditambahkan",ephemeral:true});
  }
});

/* ================= READY ================= */

client.once("clientReady", async ()=>{
  console.log("BOT ONLINE - FULL SYSTEM");

  const commands=[
    new SlashCommandBuilder().setName("cooldown").setDescription("Cek cooldown"),
    new SlashCommandBuilder().setName("soal").setDescription("Kirim quiz"),
    new SlashCommandBuilder()
      .setName("addpoin")
      .setDescription("Tambah poin")
      .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(o=>o.setName("jumlah").setDescription("Jumlah").setRequired(true))
  ].map(c=>c.toJSON());

  const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id,process.env.GUILD_ID),
    {body:commands}
  );
});

client.login(process.env.TOKEN);