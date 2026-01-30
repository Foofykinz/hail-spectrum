export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://hailspectrum.com',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Census lookup endpoint
    if (url.pathname === '/census-lookup' && request.method === 'POST') {
      try {
        const { lat, lon } = await request.json();

        // Get ZIP from Nominatim
        const nominatimResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
          { headers: { 'User-Agent': 'HailSpectrum/1.0' } }
        );
        const nominatimData = await nominatimResponse.json();
        const zipCode = nominatimData.address?.postcode?.split('-')[0] || 'Unknown';

        // Get population from Census
        let population = 7383;
        if (zipCode !== 'Unknown' && env.CENSUS_API_KEY) {
          const popUrl = `https://api.census.gov/data/2020/dec/pl?get=P1_001N,NAME&for=zip%20code%20tabulation%20area:${zipCode}&key=${env.CENSUS_API_KEY}`;
          const popResponse = await fetch(popUrl);
          const popData = await popResponse.json();
          if (popData && popData[1]) {
            const zipPopulation = parseInt(popData[1][0]);
            population = Math.round(zipPopulation * 0.3);
          }
        }

        return new Response(JSON.stringify({ zip: zipCode, population }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ zip: 'Unknown', population: 7383 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Property lookup endpoint
    if (url.pathname === '/property-lookup' && request.method === 'POST') {
      try {
        const { lat, lon } = await request.json();

        // Geocodio reverse geocode + property data
        const geocodioUrl = `https://api.geocod.io/v1.7/reverse?q=${lat},${lon}&fields=cd&api_key=${env.GEOCODIO_API_KEY}`;
        const response = await fetch(geocodioUrl);
        const data = await response.json();

        if (data.results && data.results[0]) {
          const result = data.results[0];
          const fields = result.fields || {};
          
          return new Response(JSON.stringify({
            address: result.formatted_address || 'Unknown',
            propertyType: fields.property_type || 'Unknown',
            yearBuilt: fields.year_built || null,
            bedrooms: fields.bedrooms || null,
            bathrooms: fields.bathrooms || null,
            sqft: fields.square_footage || null,
            lotSize: fields.lot_size || null,
            assessedValue: fields.assessed_value || null,
            marketValue: fields.market_value || null,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ error: 'No property data found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};