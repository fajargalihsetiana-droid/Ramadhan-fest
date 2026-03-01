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

const ROLE_ID = "1476291125227815210";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const DATA_FILE = "./data.json";
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getToday() {
  const now = new Date();
  return new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  )
    .toISOString()
    .split("T")[0];
}

function getUser(id) {
  if (!data[id]) {
    data[id] = {
      points: 0,
      daily: { date: getToday(), earned: 0 }
    };
  }

  if (!data[id].daily) {
    data[id].daily = { date: getToday(), earned: 0 };
  }

  if (data[id].daily.date !== getToday()) {
    data[id].daily.date = getToday();
    data[id].daily.earned = 0;
  }

  return data[id];
}

/* ================= REWARD SYSTEM ================= */

function calculateReward(totalPoints) {
  if (totalPoints >= 1000) return 10;
  if (totalPoints >= 500) return 12;
  if (totalPoints >= 200) return 15;
  return 20;
}

function calculateDailyCap(totalPoints) {
  if (totalPoints >= 1000) return 40;
  if (totalPoints >= 500) return 45;
  if (totalPoints >= 200) return 50;
  return 60;
}

/* ================= HISTORY ================= */

async function logPoint(guild, userId, amount) {
  const channel = guild.channels.cache.get(process.env.HISTORY_CHANNEL_ID);
  if (!channel) return;

  const member = await guild.members.fetch(userId);
  const user = getUser(userId);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: member.user.username,
      iconURL: member.user.displayAvatarURL()
    })
    .setTitle("🌙 Update Poin Ramadhan Fest")
    .setDescription(
      `➕ +${amount} poin\n📌 Menang Quiz\n🏆 Total: ${user.points}`
    )
    .setColor("Gold")
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= QUESTIONS ================= */

const questions = [];
function add(q,o,a){ questions.push({question:q,options:o,answer:a}); }

for(let i=1;i<=100;i++){
  add(`${i} + ${i+5} = ?`,
    [String(i+i+5),String(i+i+4),String(i+i+6),String(i+i+7)],
    0);
}

add("Ibukota Indonesia?",["Bandung","Jakarta","Medan","Surabaya"],1);
add("Planet terbesar?",["Mars","Venus","Jupiter","Bumi"],2);
add("Jumlah rukun Islam?",["4","5","6","7"],1);

while(questions.length < 250){
  const pick = questions[Math.floor(Math.random()*questions.length)];
  add(pick.question + " (variasi)", pick.options, pick.answer);
}

/* ================= QUIZ ================= */

let activeQuiz = null;

async function sendQuiz(){
  if(activeQuiz) return;

  const channel = client.channels.cache.get(process.env.QUIZ_CHANNEL_ID);
  if(!channel) return;

  const q = questions[Math.floor(Math.random()*questions.length)];

  const embed = new EmbedBuilder()
    .setTitle("🌙 QUIZ RAMADHAN FEST")
    .setDescription(
      `**${q.question}**\n\n`+
      `A. ${q.options[0]}\n`+
      `B. ${q.options[1]}\n`+
      `C. ${q.options[2]}\n`+
      `D. ${q.options[3]}\n\n`+
      `⏳ 1 jam`
    )
    .setColor("Gold");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("0").setLabel("A").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("1").setLabel("B").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("2").setLabel("C").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("3").setLabel("D").setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({
    content: `<@&${ROLE_ID}> 📢 Quiz baru sudah muncul!`,
    embeds:[embed],
    components:[row],
    allowedMentions: { roles: [ROLE_ID] }
  });

  activeQuiz = { correct: q.answer, answered: [] };

  setTimeout(async ()=>{
    if(!activeQuiz) return;
    await msg.edit({components:[]});
    channel.send("⏰ Waktu habis! Soal hangus.");
    activeQuiz=null;
  },60*60*1000);
}

/* ================= AUTO ================= */

function scheduleDaily(){
  for(let i=0;i<10;i++){
    const delay = Math.floor(Math.random()*24*60*60*1000);
    setTimeout(sendQuiz,delay);
  }
}
setInterval(scheduleDaily,24*60*60*1000);

/* ================= INTERACTION ================= */

client.on("interactionCreate", async interaction=>{

  if(interaction.isButton()){

    if(!activeQuiz)
      return interaction.reply({content:"Soal sudah selesai.",ephemeral:true});

    if(activeQuiz.answered.includes(interaction.user.id))
      return interaction.reply({content:"Kamu sudah menjawab.",ephemeral:true});

    activeQuiz.answered.push(interaction.user.id);

    if(parseInt(interaction.customId)===activeQuiz.correct){

      const user = getUser(interaction.user.id);
      let reward = calculateReward(user.points);
      const cap = calculateDailyCap(user.points);

      if(user.daily.earned >= cap){
        return interaction.reply({
          content:`⚠ Kamu sudah mencapai limit ${cap} poin hari ini.`,
          ephemeral:true
        });
      }

      if(user.daily.earned + reward > cap){
        reward = cap - user.daily.earned;
      }

      user.points += reward;
      user.daily.earned += reward;

      saveData();
      await logPoint(interaction.guild,interaction.user.id,reward);

      return interaction.reply({content:`🔥 Benar! +${reward} poin`,ephemeral:true});
    }

    return interaction.reply({content:"❌ Salah!",ephemeral:true});
  }

  if(interaction.isChatInputCommand()){

    if (interaction.commandName === "quiz") {

  await interaction.reply({
    content: "⏳ Mengirim soal...",
    ephemeral: true
  });

  await sendQuiz();

    }

    if(interaction.commandName==="addpoin"){
      const target = interaction.options.getUser("user");
      const jumlah = interaction.options.getInteger("jumlah");

      const user = getUser(target.id);
      user.points += jumlah;
      saveData();

      return interaction.reply({content:"Poin ditambahkan.",ephemeral:true});
    }
  }
});

/* ================= READY ================= */

client.once("clientReady", async ()=>{
  console.log("BOT ONLINE");
  scheduleDaily();

  const commands = [
    new SlashCommandBuilder()
      .setName("quiz")
      .setDescription("Munculkan soal sekarang"),

    new SlashCommandBuilder()
      .setName("addpoin")
      .setDescription("Tambah poin manual")
      .addUserOption(o=>
        o.setName("user")
         .setDescription("User target")
         .setRequired(true)
      )
      .addIntegerOption(o=>
        o.setName("jumlah")
         .setDescription("Jumlah poin")
         .setRequired(true)
      )
  ].map(c=>c.toJSON());

  const rest = new REST({version:"10"}).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
    {body:commands}
  );
});

client.login(process.env.TOKEN);

