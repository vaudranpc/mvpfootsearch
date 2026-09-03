fetch("header.html")
    .then(res => res.text())
    .then(data => {
      const headerContainer = document.getElementById("header-container");
      if (!headerContainer) return;
      headerContainer.innerHTML = data;
      // Important : exécuter les <script> du header après inclusion
      const scripts = headerContainer.querySelectorAll("script");
      scripts.forEach(script => {
        const newScript = document.createElement("script");
        newScript.text = script.textContent;
        document.body.appendChild(newScript);
      });
    });


    fetch("news.html")
    .then(res => res.text())
    .then(data => {
      const footerContainer = document.getElementById("footer-container");
      if (!footerContainer) return;
      footerContainer.innerHTML = data;
      // Important : exécuter les <script> du header après inclusion
      const scripts = footerContainer.querySelectorAll("script");
      scripts.forEach(script => {
        const newScript = document.createElement("script");
        newScript.text = script.textContent;
        document.body.appendChild(newScript);
      });
    })
    .catch(() => {});