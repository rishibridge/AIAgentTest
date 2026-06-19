const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(`
    <html>
      <body style="font-family: Arial, sans-serif; padding: 40px;">
        <h1>HOSPITAL DISCHARGE SUMMARY</h1>
        <p><strong>Patient:</strong> John Doe</p>
        <p><strong>Date:</strong> Oct 25, 2023</p>
        
        <h2>DIAGNOSIS:</h2>
        <p>Acute myocardial infarction.</p>
        
        <h2>HOSPITAL COURSE:</h2>
        <p>Patient arrived via EMS with severe chest pain. 
        ECG showed ST elevation. Patient was immediately 
        taken to the cath lab. A stent was placed in the LAD.
        Patient recovered well and is discharged on beta blockers.</p>
        
        <p><strong>NOTE:</strong> Patient reported an allergy to Aspirin during admission.</p>
      </body>
    </html>
  `);
  
  await page.pdf({ path: 'medical_chart.pdf', format: 'A4' });
  console.log("Saved medical_chart.pdf");
  
  await browser.close();
})();
