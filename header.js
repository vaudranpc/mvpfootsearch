fetch("header.html")
    .then(res => res.text())
    .then(data => {
      document.getElementById("header-container").innerHTML = data;
      // Important : exécuter les <script> du header après inclusion
      const scripts = document.getElementById("header-container").querySelectorAll("script");
      scripts.forEach(script => {
        const newScript = document.createElement("script");
        newScript.text = script.textContent;
        document.body.appendChild(newScript);
      });
    });


    fetch("news.html")
    .then(res => res.text())
    .then(data => {
      document.getElementById("footer-container").innerHTML = data;
      // Important : exécuter les <script> du header après inclusion
      const scripts = document.getElementById("footer-container").querySelectorAll("script");
      scripts.forEach(script => {
        const newScript = document.createElement("script");
        newScript.text = script.textContent;
        document.body.appendChild(newScript);
      });
    });