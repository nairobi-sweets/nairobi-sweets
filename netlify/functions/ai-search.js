const aiOpen = document.getElementById("aiOpen");
const aiClose = document.getElementById("aiClose");
const aiPanel = document.getElementById("aiPanel");
const aiInput = document.getElementById("aiInput");
const aiSearchBtn = document.getElementById("aiSearchBtn");
const aiAnswer = document.getElementById("aiAnswer");
const aiResults = document.getElementById("aiResults");

aiOpen.addEventListener("click", () => {
  aiPanel.classList.add("active");
});

aiClose.addEventListener("click", () => {
  aiPanel.classList.remove("active");
});

aiInput.addEventListener("keydown", (e) => {

  if(e.key === "Enter"){
    runAISearch();
  }

});

aiSearchBtn.addEventListener(
  "click",
  runAISearch
);

async function runAISearch(){

  const query = aiInput.value.trim();

  if(!query){

    aiAnswer.innerHTML = `
      Sweet needs a clue 💋<br><br>
      Try:
      <br>
      • VIP in Kilimani
      <br>
      • Westlands WhatsApp
      <br>
      • Most liked
    `;

    return;
  }

  aiAnswer.innerHTML = `
    Sweet is searching... ✨
  `;

  aiResults.innerHTML = "";

  try{

    const response = await fetch(
      "/.netlify/functions/ai-search",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({ query })
      }
    );

    const data = await response.json();

    if(!response.ok){

      throw new Error(
        data.error ||
        "Search failed"
      );
    }

    aiAnswer.innerHTML =
      data.answer ||
      "Sweet found some matches 💋";

    aiResults.innerHTML =
      (data.results || [])
      .map(profile => `

        <div
          class="ai-result"
          onclick="window.location.href='/profile.html?id=${profile.id}'"
        >

          <img
            src="${
              profile.photo_url ||
              '/assets/logo/logo-badge.png'
            }"

            onerror="
              this.src='/assets/logo/logo-badge.png'
            "
          >

          <div>

            <strong>
              ${profile.stage_name}
            </strong>

            <span>
              📍 ${profile.location}
            </span>

            <br>

            <span>
              ❤️ ${profile.likes_count}
              ·
              👁️ ${profile.views_count}
            </span>

          </div>

        </div>

      `).join("");

    if(!data.results || !data.results.length){

      aiResults.innerHTML = "";
    }

  }catch(error){

    aiAnswer.innerHTML = `
      Sweet got distracted 💔<br><br>
      Please try again.
    `;
  }
}
