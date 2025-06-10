"use strict";
// ** Write your module here **
// It must send an event "order_details" from the page containing an Order object,
// which describes all the relevant data points on the page.
// The order_details data you are sending should match the `expected_output` object in `test.js`

const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');

const HTML_FILE_NAME = './walmart_order.html';
const filePath = path.join(__dirname, HTML_FILE_NAME);

async function extractOrderData() {
    try{
        let htmlContent = await readHTMLFile(filePath);
        
        const extractedData = {};

        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;

        // --------------Extract Order Imfo -------------
        const orderInfoDivs = Array.from(document.querySelectorAll('div.tc.mt1.f6'));
        const orderDiv = orderInfoDivs.find(div => div.textContent.includes('Order #'));

        if (orderDiv) {
            const match = orderDiv.textContent.match(/Order\s+#(\d+)/);
            if (match) {
                extractedData['Order Number'] = match[1]; // Just the number without #
            }
        }

        // --------------Extract Subtotal, Grand total and Tax-----------------
        const totalSavedElement = document.querySelector('h1.b.ma0.mb3.f2');
        const totalSavedMatch = totalSavedElement?.textContent?.match(/\$([\d\.]+) today!/);
        const totalSaved = totalSavedMatch ? totalSavedMatch[1] : 'N/A';
        
        const iframe = document.querySelector('iframe[src*="cart_total"]');
        if (!iframe) {
            throw new Error('Iframe with cart_total not found.');
        }

        const src = iframe.getAttribute('src');
        const queryString = src.split('?')[1];
        const params = new URLSearchParams(queryString);

        extractedData['Subtotal'] = params.get('subtotal');
        extractedData['Grand Total'] = params.get('cart_total');
        extractedData['Tax'] = (parseFloat(extractedData['Grand Total']) - parseFloat(extractedData['Subtotal'])).toFixed(2);

        // --------------Extract Shipping-----------------
        // extractedData['Shipping'] = '0.00'; // todo: stated as free shipping
        const shippingHeader = document.querySelector('[data-testid="shipping-card-header"] h2');
        if (shippingHeader) {
            const text = shippingHeader.textContent.trim().toLowerCase();
            if (text.includes('free')) {
                extractedData['Shipping'] = '0';
            } else {
                const match = text.match(/\$[\d.]+/);
                extractedData['Shipping'] = match ? match[0].replace('$', '') : 'Unknown';
            }
        }


        // --------------Extract Payment Type-----------------
        const h3List = Array.from(document.querySelectorAll('h3'));
        const paymentHeader = h3List.find(h3 => h3.textContent.trim().toLowerCase() === 'payment method');

        if (paymentHeader) {
          const paymentSection = paymentHeader.closest('section');
          const img = paymentSection?.querySelector('img[alt]');
          extractedData['Payment Type'] = img?.getAttribute('alt') || 'Unknown';
        }

        // --------------Extract Product Details-----------------
        // Extract product names from <img alt="">
        const collapsedItemList = document.querySelector('[data-testid="collapsedItemList"]');
        const productImgs = collapsedItemList ? collapsedItemList.querySelectorAll('img[alt]') : [];
        const productNames = Array.from(productImgs)
            .map(img => img.getAttribute('alt'))
            .filter(alt => alt && alt.length > 10 && !alt.toLowerCase().includes('decorative image'));

        const priceArray = params.get('item_prices')
            .split(',')
            .map(val => parseFloat(val));
        const quantityArray = params.get('item_quantities')
            .split(',')
            .map(val => parseInt(val));

        extractedData['Products'] = productNames.map((name, index) => {
            const price = priceArray[index] || 0;
            const quantity = quantityArray[index] || 1;
            return {
            "Product Name": name,
            "Unit Price": price.toFixed(2),
            "Quantity": quantity,
            "Line Total": (price * quantity).toFixed(2)
            };
        });

        // console.log(extractedData)
        return extractedData;
    } catch(error){
        console.log(`Error Occurred ${error.message}`);
    }
}

async function readHTMLFile(filePath) {
    try {
        return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
        console.error(`An error occurred while reading the file: ${error.message}`);
        throw error;
    }
}

// extractOrderData();

module.exports = {extractOrderData};