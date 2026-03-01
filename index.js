require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const fs = require("fs");

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= DATA ================= */

const DATA_FILE = "./data.json";
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(id) {
  if (!data[id]) data[id] = { points: 0 };
  return data[id];
}

/* ================= LOG HISTORY ================= */

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
    .setDescription(`➕ +${amount} poin\n📌 Menang Quiz\n🏆 Total: ${user.points}`)
    .setColor("Gold")
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= 250 SOAL ================= */

const questions = [];

function add(q,o,a){
  questions.push({question:q,options:o,answer:a});
}

/* 100 Soal Matematika */
for(let i=1;i<=50;i++){
  add(`${i} + ${i+7} = ?`,
    [String(i+i+7),String(i+i+6),String(i+i+8),String(i+i+9)],0);
}

for(let i=5;i<=54;i++){
  add(`${i} x 3 = ?`,
    [String(i*3),String(i*3+3),String(i*3-3),String(i*3+6)],0);
}

/* Umum */
add("Ibukota Indonesia?",["Bandung","Jakarta","Medan","Surabaya"],1);
add("Proklamasi Indonesia tahun?",["1944","1945","1946","1947"],1);
add("Gunung tertinggi Indonesia?",["Semeru","Rinjani","Jayawijaya","Kerinci"],2);
add("Planet terbesar?",["Mars","Venus","Jupiter","Bumi"],2);
add("Planet terdekat matahari?",["Mars","Merkurius","Venus","Bumi"],1);
add("Benua terbesar?",["Asia","Eropa","Afrika","Amerika"],0);
add("Air mendidih pada?",["90°C","95°C","100°C","110°C"],2);
add("Ibukota Jepang?",["Tokyo","Kyoto","Osaka","Nagoya"],0);
add("Hewan tercepat?",["Kuda","Cheetah","Singa","Serigala"],1);

/* Islam */
add("Jumlah rukun Islam?",["4","5","6","7"],1);
add("Sholat wajib sehari?",["4","5","6","7"],1);
add("Jumlah rakaat Subuh?",["2","3","4","5"],0);
add("Kitab suci Islam?",["Injil","Taurat","Al-Quran","Zabur"],2);
add("Bulan puasa?",["Rajab","Ramadhan","Syawal","Muharram"],1);
add("Nabi terakhir?",["Isa","Musa","Muhammad","Ibrahim"],2);

/* Isi sampai 250 dengan variasi */
const base = [...questions];
while(questions.length < 250){
  const pick = base[Math.floor(Math.random()*base.length)];
  add(pick.question + " ?", pick.options, pick.answer);
}

/* ================= QUIZ SYSTEM ================= */

let activeQuiz = null;

/* Kirim Quiz */
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
      `⏳ Waktu 5 menit`
    )
    .setColor("Gold");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("0").setLabel("A").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("1").setLabel("B").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("2").setLabel("C").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("3").setLabel("D").setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({embeds:[embed],components:[row]});

  activeQuiz = {
    correct: q.answer,
    answered: []
  };

  setTimeout(async ()=>{
    if(!activeQuiz) return;
    await msg.edit({components:[]});
    channel.send("⏰ Waktu habis! Soal hangus.");
    activeQuiz = null;
  },5*60*1000);
}

/* ================= JADWAL STABIL ================= */

function startScheduler(){
  runDaily();

  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24,0,0,0);

  const firstDelay = midnight - now;

  setTimeout(()=>{
    runDaily();
    setInterval(runDaily,24*60*60*1000);
  }, firstDelay);
}

function runDaily(){
  for(let i=0;i<10;i++){
    const delay = Math.floor(Math.random()*24*60*60*1000);
    setTimeout(sendQuiz,delay);
  }
}

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async interaction=>{
  if(!interaction.isButton()) return;

  if(!activeQuiz)
    return interaction.reply({content:"Soal sudah selesai.",ephemeral:true});

  if(activeQuiz.answered.includes(interaction.user.id))
    return interaction.reply({content:"Kamu sudah menjawab.",ephemeral:true});

  activeQuiz.answered.push(interaction.user.id);

  if(parseInt(interaction.customId)===activeQuiz.correct){

    const user = getUser(interaction.user.id);
    user.points += 10;
    saveData();

    await logPoint(interaction.guild,interaction.user.id,10);

    return interaction.reply({content:"🔥 Benar! +10 poin",ephemeral:true});
  }else{
    return interaction.reply({content:"❌ Salah!",ephemeral:true});
  }
});

/* ================= READY ================= */

client.once("ready",()=>{
  console.log("BOT ONLINE");
  startScheduler();
});

client.login(process.env.TOKEN);