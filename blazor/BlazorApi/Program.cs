using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var SECRET = "your-super-secret-key-min-32-chars-here-1234";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SECRET))
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// ---------- In-memory stores ----------
var users = new List<User>();
var foods = new List<Food> { new(1, "Rice pack", 10, 1) };

// ---------- REQ 1: REGISTER ----------
app.MapPost("/api/auth/register", (UserInput input) =>
{
    if (string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrWhiteSpace(input.Password))
        return Results.BadRequest(new { error = "Email and password required" });

    if (users.Any(u => u.Email == input.Email))
        return Results.BadRequest(new { error = "Email already exists" });

    var user = new User(
        users.Count + 1,
        input.Email,
        BCrypt.Net.BCrypt.HashPassword(input.Password),
        input.Role ?? "beneficiary");

    users.Add(user);
    return Results.Created($"/api/auth/register/{user.Id}",
        new { message = "Registered", email = user.Email, role = user.Role });
});

// ---------- REQ 1: LOGIN ----------
app.MapPost("/api/auth/login", (UserInput input) =>
{
    var user = users.FirstOrDefault(u => u.Email == input.Email);
    if (user == null || !BCrypt.Net.BCrypt.Verify(input.Password, user.PasswordHash))
        return Results.BadRequest(new { error = "Invalid credentials" });

    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role)
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SECRET));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
        claims: claims,
        expires: DateTime.Now.AddHours(1),
        signingCredentials: creds);

    return Results.Ok(new
    {
        token = new JwtSecurityTokenHandler().WriteToken(token),
        role = user.Role,
        email = user.Email
    });
});

// ---------- REQ 1: ME (Protected) ----------
app.MapGet("/api/auth/me", (ClaimsPrincipal user) =>
    Results.Ok(new
    {
        id = user.FindFirst(ClaimTypes.NameIdentifier)?.Value,
        email = user.FindFirst(ClaimTypes.Email)?.Value,
        role = user.FindFirst(ClaimTypes.Role)?.Value
    })
).RequireAuthorization();

// ---------- REQ 3: GET FOODS ----------
app.MapGet("/api/foods", () => Results.Ok(foods));

// ---------- REQ 3: POST FOOD ----------
app.MapPost("/api/foods", (FoodInput input) =>
{
    if (string.IsNullOrWhiteSpace(input.Name) || input.Quantity < 1)
        return Results.BadRequest(new { error = "Name and positive quantity are required." });

    var item = new Food(foods.Count + 1, input.Name.Trim(), input.Quantity, input.Tokens);
    foods.Add(item);
    return Results.Created($"/api/foods/{item.Id}", item);
});

// ---------- REQ 2: ACCEPT TOKEN (Protected) ----------
app.MapPost("/api/transactions/accept/{id:int}", (int id, ClaimsPrincipal user) =>
{
    var food = foods.FirstOrDefault(f => f.Id == id);
    if (food == null) return Results.NotFound(new { error = "Food not found" });
    if (food.Quantity <= 0) return Results.BadRequest(new { error = "Out of stock" });

    var updated = food with { Quantity = food.Quantity - 1 };
    foods[foods.IndexOf(food)] = updated;

    return Results.Ok(new
    {
        message = "Token accepted",
        food = updated,
        acceptedBy = user.FindFirst(ClaimTypes.Email)?.Value
    });
}).RequireAuthorization();

app.Run("http://localhost:3005");

// ---------- Records ----------
record Food(int Id, string Name, int Quantity, int Tokens);
record FoodInput(string Name, int Quantity, int Tokens = 1);
record User(int Id, string Email, string PasswordHash, string Role);
record UserInput(string Email, string Password, string? Role);