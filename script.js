// Getting the animation library 
AOS.init();

// Grabbing all the important elements from our webpage
const locationInput = document.getElementById("location");
const suggestionsDiv = document.getElementById("suggestions");
const getAdviceBtn = document.getElementById("getAdviceBtn");
const output = document.getElementById("output");

// Keeping track of what the user has selected
let selectedLocation = null;
let debounceTimer = null;

// Storing our database of crop information - how much water and nutrients each crop needs
const cropData = {
  barley: {
    baseWater: 60,
    waterFrequency: "Every 3 days",
    baseNPK: [10, 26, 26],
    fertilizerFrequency: "Monthly",
  },
  rice: {
    baseWater: 80,
    waterFrequency: "Daily",
    baseNPK: [120, 60, 40],
    fertilizerFrequency: "Bi-weekly",
  },
  wheat: {
    baseWater: 50,
    waterFrequency: "Every 5 days",
    baseNPK: [100, 50, 30],
    fertilizerFrequency: "Monthly",
  },
  cotton: {
    baseWater: 70,
    waterFrequency: "Every 4 days",
    baseNPK: [80, 40, 40],
    fertilizerFrequency: "Bi-weekly",
  },
  maize: {
    baseWater: 75,
    waterFrequency: "Every 3 days",
    baseNPK: [100, 60, 40],
    fertilizerFrequency: "Bi-weekly",
  },
  sugarcane: {
    baseWater: 90,
    waterFrequency: "Daily",
    baseNPK: [150, 75, 50],
    fertilizerFrequency: "Monthly",
  },
  millet: {
    baseWater: 55,
    waterFrequency: "Every 4 days",
    baseNPK: [80, 40, 30],
    fertilizerFrequency: "Monthly",
  },
  soybean: {
    baseWater: 65,
    waterFrequency: "Every 3 days",
    baseNPK: [60, 30, 30],
    fertilizerFrequency: "Bi-weekly",
  },
  groundnut: {
    baseWater: 60,
    waterFrequency: "Every 4 days",
    baseNPK: [40, 20, 20],
    fertilizerFrequency: "Monthly",
  },
  pulses: {
    baseWater: 50,
    waterFrequency: "Every 4 days",
    baseNPK: [20, 40, 20],
    fertilizerFrequency: "Monthly",
  },
  vegetables: {
    baseWater: 70,
    waterFrequency: "Daily",
    baseNPK: [100, 50, 50],
    fertilizerFrequency: "Bi-weekly",
  },
};

// Listening for when the user types in the location box
locationInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const query = locationInput.value.trim();

  if (query.length < 2) {
    suggestionsDiv.innerHTML = "";
    return;
  }

  // Waiting a bit before searching to avoid too many requests
  debounceTimer = setTimeout(async () => {
    const locations = await fetchLocations(query);
    displayLocationSuggestions(locations);
  }, 300);
});

// Showing the user a list of matching locations
function displayLocationSuggestions(locations) {
  suggestionsDiv.innerHTML = locations
    .map((loc) => `<div class="suggestion">${loc.display_name}</div>`)
    .join("");

  // Making each suggestion clickable
  document.querySelectorAll(".suggestion").forEach((item) => {
    item.addEventListener("click", () => {
      locationInput.value = item.textContent;
      selectedLocation = locations.find(
        (loc) => loc.display_name === item.textContent
      );
      suggestionsDiv.innerHTML = "";
    });
  });
}

// Asking the location service where places are
async function fetchLocations(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&addressdetails=1&limit=5`;

  try {
    const response = await fetch(url);
    return response.ok ? await response.json() : [];
  } catch (error) {
    console.error("Oops! Couldn't find that location:", error);
    return [];
  }
}

// Getting the latest weather information for the selected location
async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=auto`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather service is not responding");
    return await response.json();
  } catch (error) {
    console.error("Sorry, couldn't get the weather right now:", error);
    return null;
  }
}

// Figuring out how the weather affects water needs
function calculateWeatherAdjustment(weatherData) {
  if (!weatherData) return 1.0;

  const current = weatherData.current;
  const temp = current.temperature_2m;
  const humidity = current.relative_humidity_2m;
  const windSpeed = current.wind_speed_10m;
  const rainfall = current.precipitation || 0;

  // Adjusting for hot weather (more water needed)
  const tempFactor = 1 + (temp - 20) * 0.02;

  // Adjusting for dry air (more water needed)
  const humidityFactor = 1 + (100 - humidity) * 0.01;

  // Adjusting for windy conditions (increases water needs)
  const windFactor = 1 + windSpeed * 0.05;

  // Adjusting for rainfall (reduces water needed)
  const rainfallFactor = Math.max(0.5, 1 - rainfall * 0.1);

  // Combining all weather factors
  return ((tempFactor + humidityFactor + windFactor) / 3) * rainfallFactor;
}

// Figuring out how the soil type affects water needs
function calculateSoilAdjustment(soilType, soilHumidity) {
  let soilFactor = 1.0;

  // Adjusting for different soil types
  switch (soilType) {
    case "sandy":
      soilFactor *= 1.2; // Sandy soil is drying out quickly
      break;
    case "clay":
      soilFactor *= 0.8; // Clay is holding water well
      break;
    case "loam":
      soilFactor *= 1.0; // Loam is being perfect
      break;
    case "silt":
      soilFactor *= 0.9; // Silt is holding water well
      break;
    case "peat":
      soilFactor *= 0.7; // Peat is being very water-retentive
      break;
    case "chalk":
      soilFactor *= 1.1; // Chalky soil is needing extra water
      break;
  }

  // Adjusting based on current soil moisture
  if (soilHumidity !== "unknown") {
    const humidity = parseFloat(soilHumidity);
    if (humidity > 80) {
      soilFactor *= 0.8; // Soil is being very wet
    } else if (humidity > 60) {
      soilFactor *= 0.9; // Soil is being wet
    } else if (humidity < 20) {
      soilFactor *= 1.2; // Soil is being very dry
    } else if (humidity < 40) {
      soilFactor *= 1.1; // Soil is being dry
    }
  }

  return soilFactor;
}

// Calculating the final recommendations based on all factors
function calculateRecommendations(
  cropType,
  soilType,
  soilHumidity,
  weatherData
) {
  const crop = cropData[cropType] || cropData.barley; // Using barley as a fallback
  const weatherFactor = calculateWeatherAdjustment(weatherData);
  const soilFactor = calculateSoilAdjustment(soilType, soilHumidity);

  // Working out how much water is needed
  const adjustedWater = (crop.baseWater * weatherFactor * soilFactor).toFixed(
    2
  );

  // Working out how much fertilizer is needed
  const adjustedNPK = crop.baseNPK.map((value) =>
    Math.round(value * weatherFactor * soilFactor)
  );

  return {
    water: `${adjustedWater} liters per acre, ${crop.waterFrequency}`,
    fertilizer: `NPK ${adjustedNPK.join(":")}, applied ${
      crop.fertilizerFrequency
    }`,
    factors: {
      weather: weatherFactor.toFixed(2),
      soil: soilFactor.toFixed(2),
    },
  };
}

// Creating a list of weather predictions for the next 24 hours
function generateForecastTable(hourlyData) {
  let tableRows = "";

  for (let i = 0; i < 24; i++) {
    const time = new Date(hourlyData.time[i]).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    tableRows += `
            <tr>
                <td>${time}</td>
                <td>${hourlyData.temperature_2m[i]}°C</td>
                <td>${hourlyData.relative_humidity_2m[i]}%</td>
                <td>${hourlyData.wind_speed_10m[i]} km/h</td>
            </tr>
        `;
  }
  return tableRows;
}

// Handling the advice button click
getAdviceBtn.addEventListener("click", async () => {
  const cropType = document.getElementById("cropType").value;
  const soilType = document.getElementById("soilType").value || "unknown";
  const soilHumidity =
    document.getElementById("soilHumidity").value || "unknown";

  if (!validateInputs(locationInput.value, cropType, selectedLocation)) {
    displayError();
    return;
  }

  // Showing a loading message while we work
  output.innerHTML = `
        <div class="advice-section">
            <div class="advice-title">
                <i class="fas fa-spinner fa-spin"></i>
                Just a moment...
            </div>
            <div class="advice-content">
                We're checking the weather and figuring out the best advice for your crop...
            </div>
        </div>
    `;
  output.classList.add("show");

  try {
    // Getting the weather and showing the advice
    const weatherData = await fetchWeatherData(
      selectedLocation.lat,
      selectedLocation.lon
    );
    if (!weatherData) {
      throw new Error("Could not get weather information");
    }
    displayAdvice(cropType, soilType, soilHumidity, weatherData);
  } catch (error) {
    output.innerHTML = `
            <div class="advice-section">
                <div class="advice-title">
                    <i class="fas fa-exclamation-circle error-icon"></i>
                    Oops!
                </div>
                <div class="advice-content">
                    We couldn't get the weather information right now. Please try again in a moment.
                </div>
            </div>
        `;
    console.error("Something went wrong:", error);
  }
});

// Validating user inputs
function validateInputs(location, cropType, selectedLocation) {
  return location && cropType && selectedLocation;
}

// Displaying an error message if something goes wrong
function displayError() {
  output.innerHTML = `
        <div class="advice-section">
            <div class="advice-title">
                <i class="fas fa-exclamation-circle error-icon"></i>
                Missing Information
            </div>
            <div class="advice-content">
                Please tell us where your farm is and what crop you're growing.
            </div>
        </div>
    `;
  output.classList.add("show");
}

// Displaying the final advice to the user
function displayAdvice(cropType, soilType, soilHumidity, weatherData) {
  const advice = generateAdvice(cropType, soilType, soilHumidity, weatherData);
  output.innerHTML = advice;
  output.classList.add("show");
}

// Display all the advice
function generateAdvice(cropType, soilType, soilHumidity, weatherData) {
  const recommendations = calculateRecommendations(
    cropType,
    soilType,
    soilHumidity,
    weatherData
  );

  return `
        <div class="advice-section">
            <div class="advice-heading">
                Here's what we recommend for your ${cropType}:
            </div>
            <div class="advice-list">
                <div class="advice-item" style="font-size: medium; font-weight:700;">
                    <i class="fas fa-tint" style="color: rgb(0, 0, 255);  transform: translateY(5px);"></i> Water : ${
                      recommendations.water
                    }
                </div>
                <div class="advice-item" style="font-size: medium; font-weight:700;">
                    <i class="fas fa-flask" style="color: rgb(0, 128, 0); transform: translateY(5px);"></i> Fertilizer : ${
                      recommendations.fertilizer
                    }
                </div>
                <div class="advice-item">
                    <i class="fas fa-calculator" style="color: rgb(128, 0, 128); transform: translateY(5px);"></i> How we calculated this:
                    <ul>
                        <li>Weather adjustment: ${
                          recommendations.factors.weather
                        }x</li>
                        <li>Soil adjustment: ${
                          recommendations.factors.soil
                        }x</li>
                    </ul>
                </div>
                ${
                  weatherData
                    ? `
                <div class="advice-item">
                    <i class="fas fa-cloud-sun" style="color: rgb(255, 165, 0); transform: translateY(5px);"></i> Current Weather:
                    <ul>
                        <li>Temperature: ${
                          weatherData.current.temperature_2m
                        }°C</li>
                        <li>Humidity: ${
                          weatherData.current.relative_humidity_2m
                        }%</li>
                        <li>Wind Speed: ${
                          weatherData.current.wind_speed_10m
                        } km/h</li>
                        ${
                          weatherData.current.precipitation
                            ? `<li>Recent Rainfall: ${weatherData.current.precipitation}mm</li>`
                            : ""
                        }
                    </ul>

                </div>
                                    <div class="weather-forecast">
                        <h4>What's the weather going to be like?</h4>
                     <table border="1" style="width:100%; border-collapse: collapse; text-align: center;">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Temperature (°C)</th>
                                    <th>Humidity (%)</th>
                                    <th>Wind Speed (km/h)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateForecastTable(weatherData.hourly)}
                            </tbody>
                        </table>
                    </div>
                `
                    : ""
                }
            </div>
        </div>
    `;
}
