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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const DATA_FILE = "./data.json";
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

let leaderboardMessageId = null;
let activeQuiz = null;

/* ================= UTIL ================= */

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(id) {
  if (!data[id]) data[id] = { points: 0 };
  return data[id];
}

/* ================= LEADERBOARD ================= */

async function updateLeaderboard() {
  const channel = client.channels.cache.get(process.env.LEADERBOARD_CHANNEL_ID);
  if (!channel) return;

  const sorted = Object.entries(data)
    .sort((a,b)=>b[1].points - a[1].points)
    .slice(0,10);

  let text="";
  sorted.forEach((u,i)=>{
    text += `**${i+1}.** <@${u[0]}> — ${u[1].points} poin\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 Leaderboard Ramadhan Fest")
    .setDescription(text || "Belum ada data")
    .setColor("Gold")
    .setTimestamp();

  if(!leaderboardMessageId){
    const msg = await channel.send({embeds:[embed]});
    leaderboardMessageId = msg.id;
  }else{
    try{
      const msg = await channel.messages.fetch(leaderboardMessageId);
      await msg.edit({embeds:[embed]});
    }catch{
      const msg = await channel.send({embeds:[embed]});
      leaderboardMessageId = msg.id;
    }
  }
}

/* ================= HISTORY ================= */

async function logPoint(guild, userId, amount, source="Menang Quiz") {
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
    .setDescription(`➕ +${amount} poin\n📌 ${source}\n🏆 Total: ${user.points}`)
    .setColor("Gold")
    .setTimestamp();

  channel.send({embeds:[embed]});
}

/* ================= 250 SOAL ================= */

const questions=[];
function add(q,o,a){questions.push({question:q,options:o,answer:a});}

for(let i=1;i<=125;i++){
  add(`${i}+${i+2}=?`,
    [String(i+i+2),String(i+i+1),String(i+i+3),String(i+i+4)],
    0);
}

for(let i=10;i<=134;i++){
  add(`${i}x2=?`,
    [String(i*2),String(i*2+2),String(i*2-2),String(i*2+4)],
    0);
}

/* ================= QUIZ ================= */

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
      `⏳ 5 menit`
    )
    .setColor("Gold");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("0").setLabel("A").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("1").setLabel("B").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("2").setLabel("C").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("3").setLabel("D").setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({embeds:[embed],components:[row]});

  activeQuiz = {correct:q.answer,answered:[]};

  setTimeout(async ()=>{
    if(!activeQuiz) return;
    await msg.edit({components:[]});
    channel.send("⏰ Waktu habis! Soal hangus.");
    activeQuiz=null;
  },5*60*1000);
}

/* ================= SCHEDULER ================= */

function scheduleDaily(){
  for(let i=0;i<10;i++){
    const delay=Math.floor(Math.random()*24*60*60*1000);
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

      const user=getUser(interaction.user.id);
      user.points+=10;
      saveData();

      await logPoint(interaction.guild,interaction.user.id,10);
      await updateLeaderboard();

      return interaction.reply({content:"🔥 Benar! +10 poin",ephemeral:true});
    }else{
      return interaction.reply({content:"❌ Salah!",ephemeral:true});
    }
  }

  if(interaction.isChatInputCommand()){

    if(interaction.commandName==="soal"){
      if(interaction.user.id!==process.env.OWNER_ID)
        return interaction.reply({content:"Tidak punya izin.",ephemeral:true});

      await sendQuiz();
      return interaction.reply({content:"Soal dikirim.",ephemeral:true});
    }

    if(interaction.commandName==="addpoin"){
      if(interaction.user.id!==process.env.OWNER_ID)
        return interaction.reply({content:"Tidak punya izin.",ephemeral:true});

      const userTarget=interaction.options.getUser("user");
      const jumlah=interaction.options.getInteger("jumlah");

      const user=getUser(userTarget.id);
      user.points+=jumlah;
      saveData();

      await logPoint(interaction.guild,userTarget.id,jumlah,"Manual");
      await updateLeaderboard();

      return interaction.reply("Poin berhasil ditambahkan.");
    }
  }
});

/* ================= REGISTER COMMAND ================= */

client.once("ready", async ()=>{
  console.log("BOT ONLINE");

  const commands=[
    new SlashCommandBuilder()
      .setName("soal")
      .setDescription("Kirim soal sekarang (Owner)"),

    new SlashCommandBuilder()
      .setName("addpoin")
      .setDescription("Tambah poin manual")
      .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(o=>o.setName("jumlah").setDescription("Jumlah").setRequired(true))
  ].map(c=>c.toJSON());

  const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

  await rest.put(
  Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
  {body:commands}
);

  scheduleDaily();
  updateLeaderboard();
});

client.login(process.env.TOKEN);

