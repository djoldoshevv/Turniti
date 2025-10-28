const puppeteer = require('puppeteer');

/**
 * This script helps you inspect academi.cx to find the correct selectors and endpoints
 * Run it with: node inspect-academi.js
 */

async function inspectAcademiCx() {
    console.log('Starting browser inspection of academi.cx...\n');

    const browser = await puppeteer.launch({
        headless: false, // Show browser window
        devtools: true,  // Open DevTools automatically
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Enable request interception to log network requests
        await page.setRequestInterception(true);
        
        const requests = [];
        page.on('request', request => {
            if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
                requests.push({
                    url: request.url(),
                    method: request.method(),
                    postData: request.postData()
                });
                console.log(`📤 ${request.method()} ${request.url()}`);
            }
            request.continue();
        });

        page.on('response', async response => {
            if (response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch') {
                console.log(`📥 ${response.status()} ${response.url()}`);
            }
        });

        // Navigate to academi.cx
        console.log('Navigating to academi.cx...\n');
        await page.goto('https://academi.cx', { waitUntil: 'networkidle2' });

        // Wait a bit for page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get page title
        const title = await page.title();
        console.log(`\n📄 Page title: ${title}\n`);

        // Find all file inputs
        console.log('🔍 Looking for file input elements...\n');
        const fileInputs = await page.$$eval('input[type="file"]', inputs => 
            inputs.map((input, index) => ({
                index,
                id: input.id,
                name: input.name,
                accept: input.accept,
                multiple: input.multiple,
                className: input.className
            }))
        );

        if (fileInputs.length > 0) {
            console.log('✅ Found file inputs:');
            fileInputs.forEach(input => {
                console.log(`  - Input #${input.index}:`);
                console.log(`    ID: ${input.id || 'none'}`);
                console.log(`    Name: ${input.name || 'none'}`);
                console.log(`    Accept: ${input.accept || 'any'}`);
                console.log(`    Class: ${input.className || 'none'}`);
                console.log('');
            });
        } else {
            console.log('❌ No file inputs found');
        }

        // Find all buttons
        console.log('\n🔍 Looking for buttons...\n');
        const buttons = await page.$$eval('button, input[type="submit"], input[type="button"]', btns => 
            btns.map((btn, index) => ({
                index,
                type: btn.tagName,
                id: btn.id,
                className: btn.className,
                text: btn.textContent?.trim() || btn.value
            }))
        );

        if (buttons.length > 0) {
            console.log('✅ Found buttons:');
            buttons.forEach(btn => {
                console.log(`  - Button #${btn.index} (${btn.type}):`);
                console.log(`    ID: ${btn.id || 'none'}`);
                console.log(`    Class: ${btn.className || 'none'}`);
                console.log(`    Text: ${btn.text || 'none'}`);
                console.log('');
            });
        }

        // Find all forms
        console.log('\n🔍 Looking for forms...\n');
        const forms = await page.$$eval('form', forms => 
            forms.map((form, index) => ({
                index,
                action: form.action,
                method: form.method,
                enctype: form.enctype,
                id: form.id,
                className: form.className
            }))
        );

        if (forms.length > 0) {
            console.log('✅ Found forms:');
            forms.forEach(form => {
                console.log(`  - Form #${form.index}:`);
                console.log(`    Action: ${form.action || 'none'}`);
                console.log(`    Method: ${form.method || 'GET'}`);
                console.log(`    Enctype: ${form.enctype || 'none'}`);
                console.log(`    ID: ${form.id || 'none'}`);
                console.log(`    Class: ${form.className || 'none'}`);
                console.log('');
            });
        }

        // Get page HTML structure (simplified)
        console.log('\n📋 Page structure saved to academi-structure.html\n');
        const html = await page.content();
        const fs = require('fs');
        fs.writeFileSync('academi-structure.html', html);

        console.log('\n' + '='.repeat(60));
        console.log('🎯 INSTRUCTIONS:');
        console.log('='.repeat(60));
        console.log('1. The browser window will stay open');
        console.log('2. Try uploading a file manually');
        console.log('3. Watch the console for network requests');
        console.log('4. Check the Network tab in DevTools');
        console.log('5. Look for POST requests when you upload');
        console.log('6. Note the endpoint URL and request payload');
        console.log('7. Press Ctrl+C in terminal when done');
        console.log('='.repeat(60) + '\n');

        // Keep browser open
        await new Promise(() => {}); // Wait forever

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Browser will be closed when you press Ctrl+C
    }
}

// Run the inspection
inspectAcademiCx().catch(console.error);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n👋 Closing browser...');
    process.exit(0);
});
