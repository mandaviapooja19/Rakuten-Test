"use strict";
// ** Write your module here **
// It must send an event "order_details" from the page containing an Order object,
// which describes all the relevant data points on the page.
// The order_details data you are sending should match the `expected_output` object in `test.js`

const fs = require('fs');
const html = fs.readFileSync('./walmart_order.html', 'utf-8');

async function extractOrderData() {
  try{

    // Extract iframe src
    const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"[^>]*><\/iframe>/);
    if (!iframeMatch) {
      console.error("iframe not found");
      process.exit(1);
    }
    let iframeSrc = iframeMatch[1];
    // Safely decode HTML entities like &amp;
    if (iframeSrc.includes('&amp;')) {
      iframeSrc = iframeSrc.replace(/&amp;/g, '&');
    }

    // Parse iframe URL query params
    const query = iframeSrc.split('?')[1];
    const params = new URLSearchParams(query);

    const orderNumber = extractOrderNumber();

    const productList = extractProductList(params);

    const {shippingValue, total, subtotal, tax} = extractSubtotalAndGrandTotal(params);

    const paymentType = extractPaymentType();
    
    const extractedData = {
      "Order Number": orderNumber,
      "Products": productList, 
      "Shipping": shippingValue, 
      "Subtotal": subtotal,
      "Grand Total": total,
      "Payment Type": paymentType,
      "Tax": tax
    }
    // console.log(extractedData)
    return extractedData; 

  }catch (error){
    console.log(`Error Occurred ${error.message}`);
  }
}

function extractOrderNumber(){
  const orderNumberMatch = html.match(/Order\s+#(\d{15,})/);
  return orderNumberMatch ? orderNumberMatch[1] : null;
}

function extractProductList(params){

  const prices = params.get('item_prices')?.split(',').map(p => parseFloat(p)) || [];
  const quantities = params.get('item_quantities')?.split(',').map(q => parseInt(q)) || [];

  //Extract product names from <img alt="..."> under [data-testid="collapsedItemList"]
  const productBlock = html.split('data-testid="collapsedItemList"')[1] || '';
  const nameRegex = /<img[^>]+alt="([^"]+)"[^>]*>/g;

  const productNames = [];
  let match;
  while ((match = nameRegex.exec(productBlock)) !== null) {
    productNames.push(match[1]);
  }

  //Build product objects
  const count = Math.min(productNames.length, prices.length, quantities.length);
  const productList = [];

  for (let i = 0; i < count; i++) {
    const name = productNames[i];
    const unitPrice = prices[i];
    const quantity = quantities[i];
    const lineTotal = parseFloat((unitPrice * quantity).toFixed(2));

    productList.push({
      "Product Name": name,
      "Unit Price": unitPrice.toFixed(2),
      Quantity: quantity.toString(),
      "Line Total": lineTotal.toFixed(2)
    });
  }
  return productList;
}

function extractSubtotalAndGrandTotal(params ){
  const subtotal = parseFloat(params.get('subtotal'));
  const total = parseFloat(params.get('cart_total'));
  let shipping = parseFloat(params.get('shipping') || '0'); // fallback to 0 if not present

  //Calculate tax
  const tax = parseFloat((total - subtotal - shipping).toFixed(2));

  //Check for "Free shipping" text in visible HTML
  const hasFreeShipping = html.includes('Free shipping');
  if(hasFreeShipping){
    shipping = '0';
  }

  const result = {
    subtotal: subtotal,
    total: total,
    tax: tax,
    shippingValue: shipping
  };
  return result;
}

function extractPaymentType(){
  // Extract the payment type from the image src (e.g., wallet-visa-dark-logo.png)
  const paymentTypeMatch = html.match(/wallet-(\w+)-dark-logo\.png/i);
  return paymentTypeMatch ? capitalize(paymentTypeMatch[1]) : null;
}

// Capitalize first letter helper (e.g., visa -> Visa)
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// extractOrderData();

module.exports = {extractOrderData};
