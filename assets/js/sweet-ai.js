const sweetPanel = document.getElementById("sweetPanel");
const sweetInput = document.getElementById("sweetInput");
const sweetResults = document.getElementById("sweetResults");

function openSweet() {
  if (sweetPanel) {
    sweetPanel.classList.add("active");
  }
}

function closeSweet() {
  if (sweetPanel) {
    sweetPanel.classList.remove("active");
  }
}

function quickAsk(text) {
  if (!sweetInput) return;

  sweetInput.value = text;
  askSweet();
}

async function askSweet() {
  if (!sweetInput || !sweetResults) return;

  const message = sweetInput.value.trim();

  if (!message) {
    sweetResults.innerHTML = `
      Sweet needs a clue 💋<br><br>
      Try:<br>
      • VIP in Kilimani<br>
      • Westlands WhatsApp<br>
      • Online now
    `;
    return;
  }

  sweetResults.innerHTML = "Sweet is searching... ✨";

  try {
    const response = await fetch("/.netlify/functions/sweet-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Sweet search failed");
    }

    const profiles = data.results || data.profiles || [];

    let profileCards = "";

    if (profiles.length) {
      profileCards = profiles.map(profile => `
        <div
          class="sweet-result-card"
          onclick="window.location.href='/profile.html?id=${profile.id}'"
        >
          <img
            src="${profile.photo_url || "/assets/logo/logo-badge.png"}"
            onerror="this.src='/assets/logo/logo-badge.png'"
          >

          <div>
            <strong>${profile.stage_name || "Verified Profile"}</strong>
            <span>📍 ${profile.location || "Nairobi"}</span>
            <span>❤️ ${profile.likes_count || 0} · 👁️ ${profile.views_count || 0}</span>
          </div>
        </div>
      `).join("");
    }

    sweetResults.innerHTML = `
      <div class="sweet-reply">
        ${data.reply || data.answer || "Sweet found something interesting 💋"}
      </div>

      ${profileCards}
    `;

  } catch (error) {
    console.error(error);

    sweetResults.innerHTML = `
      Sweet got distracted 💔<br><br>
      Please try again.
    `;
  }
}

if (sweetInput) {
  sweetInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      askSweet();
    }
  });
}

window.openSweet = openSweet;
window.closeSweet = closeSweet;
window.quickAsk = quickAsk;
window.askSweet = askSweet;
