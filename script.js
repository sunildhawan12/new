const allowedLat = 26.486691442317298;
const allowedLng = 74.63343361051672;
const radius = 0.05;
const URL = 'https://script.google.com/macros/s/AKfycbzhR-60-AUw2gL6_8ro7Dm3arl0exFNJ0a3n0MYPE-r-s4YwLrJDkJsT31mYk9LqqG92g/exec';

const studentMap = {
  "101": { name: "Rahul" },
  "102": { name: "Vishal" },
  "103": { name: "Anjali" },
  "105": { name: "Anju" },
  "106": { name: "Snju" },
  "107": { name: "Aunj" },
  "109": { name: "Sajna" },
  "501": { name: "Sunil" },
};

let attendanceCache = {};
let allData = [];

function goToNextPage() {
  document.getElementById("welcomePage").style.display = "none";
  document.getElementById("mainContainer").style.display = "block";
}

function showAttendancePage() {
  const id = document.getElementById("studentId").value.trim();
  if (!id) {
    document.getElementById("submitMsg").textContent = "❌ Please enter ID.";
    document.getElementById("submitMsg").className = "status error";
    return;
  }
  document.getElementById("mainPage").style.display = "none";
  document.getElementById("attendancePage").style.display = "block";
  document.getElementById("idBox").value = id;
  checkLocation();
}

function checkLocation() {
  const msg = document.getElementById('msg');

  if (!navigator.geolocation) {
    msg.innerHTML = "❌ Geolocation not supported.";
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const dist = getDistance(lat, lng, allowedLat, allowedLng);

    if (dist <= radius) {
      msg.innerHTML = "✅ Location Matched!";
      document.getElementById('idBox').disabled = false;
      document.getElementById('inBtn').disabled = false;
      document.getElementById('outBtn').disabled = false;
    } else {
      msg.innerHTML = `❌ Location mismatch (Distance: ${dist.toFixed(3)} km)`;
    }
  }, err => {
    msg.innerHTML = `❌ Location Error: ${err.message}`;
  });
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function sendToGoogleSheet(id, status, lat, lng) {
  const formData = new URLSearchParams();
  formData.append("ID", id);
  formData.append("Status", status);
  formData.append("Location", `${lat},${lng}`);
  formData.append("Bypass", "true");

  fetch(URL, { method: "POST", body: formData }).catch(() => {
    console.warn("❌ Google Sheet store failed silently.");
  });
}
async function submitAttendance(status) {
  const id = document.getElementById("idBox").value.trim();
  const msg = document.getElementById("msg");
  const loading = document.getElementById("loading");

  if (!id) {
    msg.innerHTML = "❌ कृपया अपना ID दर्ज करें।";
    return;
  }

  const today = new Date().toLocaleDateString();
  const cacheKey = `${id}_${status}_${today}`;
  if (attendanceCache[cacheKey]) {
    msg.innerHTML = `⚠️ आज के लिए पहले ही "${status}" दर्ज किया जा चुका है।`;
    return;
  }

  loading.style.display = "block";
  msg.innerHTML = "⏳ Location verify की जा रही है... कृपया प्रतीक्षा करें...";

  if (!navigator.geolocation) {
    msg.innerHTML = "❌ आपका ब्राउज़र location सपोर्ट नहीं करता।";
    loading.style.display = "none";
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const dist = getDistance(lat, lng, allowedLat, allowedLng);

    if (dist > radius) {
      msg.innerHTML = "❌ आप अनुमति प्राप्त स्थान पर नहीं हैं।";
      loading.style.display = "none";
      return;
    }

    const timeNow = new Date().toLocaleTimeString();

    if (studentMap[id]) {
      // ✅ If student found in local object
      msg.innerHTML = `✅ नमस्ते <b style="color: #ff009d">${studentMap[id].name}</b>! आपकी "${status}" उपस्थिति 🕒 ${timeNow} पर दर्ज हो गई है।`;
      loading.style.display = "none";
      attendanceCache[cacheKey] = true;
      sendToGoogleSheet(id, status, lat, lng);
    } else {
      // ✅ If not in studentMap — fallback to Firebase sheet
      try {
        const formData = new URLSearchParams();
        formData.append("ID", id);
        formData.append("Status", status);
        formData.append("Location", `${lat},${lng}`);

        const res = await fetch(URL, { method: "POST", body: formData });
        const data = await res.json();
        loading.style.display = "none";

        if (data.result === "success") {
          msg.innerHTML = `✅ नमस्ते <b style="color: #ff009d">${data.name}</b>! आपकी "${status}" उपस्थिति 🕒 ${data.time} पर दर्ज हो गई है।`;
          attendanceCache[cacheKey] = true;
        } else if (data.result === "already_done") {
          msg.innerHTML = `⚠️ आज के लिए "${status}" पहले ही दर्ज हो चुकी है।`;
        } else {
          msg.innerHTML = `❌ ${data.message || "Unknown error"}`;
        }
      } catch (err) {
        msg.innerHTML = "❌ नेटवर्क त्रुटि। कृपया दोबारा प्रयास करें।";
        loading.style.display = "none";
      }
    }
  }, err => {
    loading.style.display = "none";
    msg.innerHTML = `❌ Location access असफल: ${err.message}`;
  }, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  });
}

