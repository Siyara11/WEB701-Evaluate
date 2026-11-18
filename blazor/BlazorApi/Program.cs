<<<<<<< HEAD
// Program.cs
// ---------------------------------------------------------------------------
// .NET 8 / Blazor stack prototype for the Nelson Community Tool Shed.
// Back end: ASP.NET Core Minimal API (C#). A Blazor front end would call these
// endpoints with HttpClient. Data is stored with Entity Framework Core in a
// SQLite database file (toolshed.db); change the connection string in
// appsettings.json to use SQL Server or PostgreSQL instead.
// Run:  dotnet run      then open http://localhost:3005/swagger
//  [R1] /api/auth/register, /api/auth/login, /api/auth/me (GET + PUT)
//  [R2] /api/tools/{id}/borrow, /api/borrowings/{id}/accept|decline|return
//  [R3] /api/tools (GET, POST, PUT, DELETE)
// ---------------------------------------------------------------------------
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Secret used to sign JWTs - read from configuration (appsettings.json / environment)
var secret = builder.Configuration["Jwt:Secret"] ?? "dev-only-secret-change-me-at-least-32-chars!!";
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

// [R3] Register the EF Core DbContext with the SQLite provider
builder.Services.AddDbContext<ToolShedDb>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("ToolShed") ?? "Data Source=toolshed.db"));

// [R1] JWT bearer authentication: every request with "Authorization: Bearer <token>"
// is validated (signature + expiry) and turned into a ClaimsPrincipal (the user).
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // keep claim names exactly as we wrote them ("sub", "role")
=======
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
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
<<<<<<< HEAD
            ValidateLifetime = true,          // reject expired tokens
            ValidateIssuerSigningKey = true,  // reject tampered tokens
            IssuerSigningKey = signingKey,
            RoleClaimType = "role",           // lets RequireRole("member") read our role claim
            NameClaimType = "sub"
=======
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SECRET))
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
        };
    });
builder.Services.AddAuthorization();

<<<<<<< HEAD
// Swagger with an "Authorize" button for pasting the JWT
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", In = ParameterLocation.Header
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() }
    });
});

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication(); // reads and validates the JWT
app.UseAuthorization();  // applies RequireAuthorization() rules

// [R3] Create the database and tables if they do not exist, then add demo data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ToolShedDb>();
    db.Database.EnsureCreated();
    if (!db.Users.Any())
    {
        var member = new User { FullName = "Aroha Member", Email = "member@toolshed.nz", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123"), Role = "member" };
        db.Users.AddRange(member, new User { FullName = "Ben Beneficiary", Email = "beneficiary@toolshed.nz", PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123"), Role = "beneficiary" });
        db.SaveChanges();
        db.Tools.AddRange(
            new Tool { OwnerId = member.Id, Name = "Cordless Drill", Category = "Power Tools" },
            new Tool { OwnerId = member.Id, Name = "Garden Spade", Category = "Garden", Condition = "Well Loved" });
        db.SaveChanges();
    }
}

// Helper: read the user id from the validated token
static int UserId(ClaimsPrincipal p) => int.Parse(p.FindFirstValue("sub")!);

// ======================= [R1] ACCOUNTS (JWT) =======================
app.MapPost("/api/auth/register", async (RegisterInput input, ToolShedDb db) =>
{
    if (string.IsNullOrWhiteSpace(input.FullName) || string.IsNullOrWhiteSpace(input.Email) || (input.Password ?? "").Length < 8)
        return Results.BadRequest(new { error = "fullName, email and a password of 8+ characters are required" });

    var email = input.Email.Trim().ToLowerInvariant();
    if (await db.Users.AnyAsync(u => u.Email == email))
        return Results.Conflict(new { error = "Email already registered" });

    var user = new User
    {
        FullName = input.FullName.Trim(),
        Email = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(input.Password), // salted bcrypt hash
        Role = input.Role == "member" ? "member" : "beneficiary"         // admin cannot self-register
    };
    db.Users.Add(user);         // INSERT INTO Users ...
    await db.SaveChangesAsync();
    return Results.Created($"/api/users/{user.Id}", UserDto.From(user));
});

app.MapPost("/api/auth/login", async (LoginInput input, ToolShedDb db) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == (input.Email ?? "").ToLower());
    if (user is null || !BCrypt.Net.BCrypt.Verify(input.Password ?? "", user.PasswordHash))
        return Results.Json(new { error = "Invalid email or password" }, statusCode: 401);

    // Build the JWT: claims carry the user id and role, signed with HMAC-SHA256
    var token = new JwtSecurityToken(
        claims: new[] { new Claim("sub", user.Id.ToString()), new Claim("role", user.Role), new Claim("email", user.Email) },
        expires: DateTime.UtcNow.AddHours(1),
        signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256));

    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), user = UserDto.From(user) });
});

// RequireAuthorization() = the endpoint only runs when the JWT is valid
app.MapGet("/api/auth/me", async (ClaimsPrincipal p, ToolShedDb db) =>
    await db.Users.FindAsync(UserId(p)) is { } u ? Results.Ok(UserDto.From(u)) : Results.NotFound())
   .RequireAuthorization();

app.MapPut("/api/auth/me", async (UpdateMeInput input, ClaimsPrincipal p, ToolShedDb db) =>
{
    var user = await db.Users.FindAsync(UserId(p)); // only ever the caller's own record
    if (user is null) return Results.NotFound();
    if (!string.IsNullOrWhiteSpace(input.FullName)) user.FullName = input.FullName.Trim();
    if (!string.IsNullOrEmpty(input.Password))
    {
        if (input.Password.Length < 8) return Results.BadRequest(new { error = "Password must be 8+ characters" });
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(input.Password);
    }
    await db.SaveChangesAsync(); // EF Core tracks the changes and issues an UPDATE
    return Results.Ok(UserDto.From(user));
}).RequireAuthorization();

// ======================= [R3] TOOLS (database) =======================
app.MapGet("/api/tools", async (string? q, string? category, ToolShedDb db) =>
{
    // LINQ query is translated by EF Core into parameterised SQL (safe from injection)
    var query = db.Tools.AsQueryable();
    if (!string.IsNullOrWhiteSpace(q)) query = query.Where(t => t.Name.ToLower().Contains(q.ToLower()));
    if (!string.IsNullOrWhiteSpace(category)) query = query.Where(t => t.Category == category);
    return Results.Ok(await query.OrderByDescending(t => t.Id).ToListAsync());
});

app.MapGet("/api/tools/{id:int}", async (int id, ToolShedDb db) =>
    await db.Tools.FindAsync(id) is { } t ? Results.Ok(t) : Results.NotFound(new { error = "Tool not found" }));

app.MapPost("/api/tools", async (ToolInput input, ClaimsPrincipal p, ToolShedDb db) =>
{
    if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length < 2 || input.TokenCost < 1)
        return Results.BadRequest(new { error = "Name (2+ characters) and a token cost of at least 1 are required" });
    var tool = new Tool
    {
        OwnerId = UserId(p), // owner comes from the token, not the request body
        Name = input.Name.Trim(),
        Category = input.Category ?? "Hand Tools",
        Description = input.Description ?? "",
        Condition = input.Condition ?? "Good",
        TokenCost = input.TokenCost
    };
    db.Tools.Add(tool);
    await db.SaveChangesAsync();
    return Results.Created($"/api/tools/{tool.Id}", tool);
}).RequireAuthorization(policy => policy.RequireRole("member"));

app.MapPut("/api/tools/{id:int}", async (int id, ToolInput input, ClaimsPrincipal p, ToolShedDb db) =>
{
    var tool = await db.Tools.FindAsync(id);
    if (tool is null || tool.OwnerId != UserId(p)) return Results.NotFound(new { error = "Tool not found or not yours" });
    tool.Name = input.Name ?? tool.Name;
    tool.Category = input.Category ?? tool.Category;
    tool.Description = input.Description ?? tool.Description;
    tool.Condition = input.Condition ?? tool.Condition;
    tool.TokenCost = input.TokenCost > 0 ? input.TokenCost : tool.TokenCost;
    await db.SaveChangesAsync();
    return Results.Ok(tool);
}).RequireAuthorization(policy => policy.RequireRole("member"));

app.MapDelete("/api/tools/{id:int}", async (int id, ClaimsPrincipal p, ToolShedDb db) =>
{
    var tool = await db.Tools.FindAsync(id);
    if (tool is null || tool.OwnerId != UserId(p) || tool.Status != "available")
        return Results.NotFound(new { error = "Tool not found, not yours, or on loan" });
    db.Tools.Remove(tool);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Tool removed" });
}).RequireAuthorization(policy => policy.RequireRole("member"));

// ======================= [R2] TOKEN TRANSACTIONS =======================
app.MapPost("/api/tools/{id:int}/borrow", async (int id, ClaimsPrincipal p, ToolShedDb db) =>
{
    var me = await db.Users.FindAsync(UserId(p));
    var tool = await db.Tools.FindAsync(id);
    if (tool is null) return Results.NotFound(new { error = "Tool not found" });
    if (me!.TokenBalance < tool.TokenCost) return Results.BadRequest(new { error = "Not enough tokens" });

    // ExecuteUpdate runs one conditional UPDATE in the database: it only
    // changes the row if the tool is still available (prevents double booking)
    var reserved = await db.Tools.Where(t => t.Id == id && t.Status == "available")
        .ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, "requested"));
    if (reserved == 0) return Results.Conflict(new { error = "Tool is not available" });

    var b = new Borrowing { ToolId = tool.Id, BorrowerId = me.Id, LenderId = tool.OwnerId, TokensSpent = tool.TokenCost };
    db.Borrowings.Add(b);
    await db.SaveChangesAsync();
    return Results.Created($"/api/borrowings/{b.Id}", b);
}).RequireAuthorization(policy => policy.RequireRole("beneficiary"));

app.MapGet("/api/borrowings", async (ClaimsPrincipal p, ToolShedDb db) =>
{
    var id = UserId(p);
    return Results.Ok(await db.Borrowings.Where(b => b.BorrowerId == id || b.LenderId == id)
        .OrderByDescending(b => b.Id).ToListAsync());
}).RequireAuthorization();

app.MapPost("/api/borrowings/{id:int}/accept", async (int id, ClaimsPrincipal p, ToolShedDb db) =>
{
    var memberId = UserId(p);
    var b = await db.Borrowings.FirstOrDefaultAsync(x => x.Id == id && x.LenderId == memberId && x.Status == "pending");
    if (b is null) return Results.NotFound(new { error = "No pending transaction with this id for your tools" });

    // A database transaction makes the token transfer atomic: all steps are
    // committed together, or none are if anything fails.
    await using var tx = await db.Database.BeginTransactionAsync();

    // 1. Take tokens from the beneficiary only if the balance is high enough
    var taken = await db.Users.Where(u => u.Id == b.BorrowerId && u.TokenBalance >= b.TokensSpent)
        .ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenBalance, u => u.TokenBalance - b.TokensSpent));
    if (taken == 0)
    {
        await tx.RollbackAsync();
        return Results.BadRequest(new { error = "Beneficiary no longer has enough tokens" });
    }
    // 2. Credit the member  3. Mark the tool borrowed  4. Activate the transaction
    await db.Users.Where(u => u.Id == memberId)
        .ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenBalance, u => u.TokenBalance + b.TokensSpent));
    await db.Tools.Where(t => t.Id == b.ToolId).ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, "borrowed"));
    b.Status = "active";
    b.AcceptedAt = DateTime.UtcNow;
    b.DueDate = DateTime.UtcNow.AddDays(7);
    await db.SaveChangesAsync();
    await tx.CommitAsync();

    var borrower = await db.Users.AsNoTracking().FirstAsync(u => u.Id == b.BorrowerId);
    return Results.Ok(new { message = "Token accepted", transaction = b, borrowerTokenBalance = borrower.TokenBalance });
}).RequireAuthorization(policy => policy.RequireRole("member"));

app.MapPost("/api/borrowings/{id:int}/decline", async (int id, ClaimsPrincipal p, ToolShedDb db) =>
{
    var memberId = UserId(p); // read the id first so EF Core can use it as a SQL parameter
    var b = await db.Borrowings.FirstOrDefaultAsync(x => x.Id == id && x.LenderId == memberId && x.Status == "pending");
    if (b is null) return Results.NotFound(new { error = "No pending transaction with this id for your tools" });
    b.Status = "declined";
    await db.Tools.Where(t => t.Id == b.ToolId).ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, "available"));
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Request declined" });
}).RequireAuthorization(policy => policy.RequireRole("member"));

app.MapPost("/api/borrowings/{id:int}/return", async (int id, ClaimsPrincipal p, ToolShedDb db) =>
{
    var memberId = UserId(p);
    var b = await db.Borrowings.FirstOrDefaultAsync(x => x.Id == id && x.LenderId == memberId && x.Status == "active");
    if (b is null) return Results.NotFound(new { error = "No active transaction with this id for your tools" });
    b.Status = "returned";
    b.ReturnedAt = DateTime.UtcNow;
    await db.Tools.Where(t => t.Id == b.ToolId).ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, "available"));
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Tool returned and available again" });
}).RequireAuthorization(policy => policy.RequireRole("member"));

app.Run("http://localhost:3005");

// ======================= [R3] DATA MODEL (EF Core) =======================
// Each DbSet becomes a table; each class property becomes a column.
class ToolShedDb(DbContextOptions<ToolShedDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Tool> Tools => Set<Tool>();
    public DbSet<Borrowing> Borrowings => Set<Borrowing>();

    protected override void OnModelCreating(ModelBuilder m) =>
        m.Entity<User>().HasIndex(u => u.Email).IsUnique(); // no duplicate emails
}

class User
{
    public int Id { get; set; }                       // primary key (auto increment)
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";    // never returned to the client (see UserDto)
    public string Role { get; set; } = "beneficiary";
    public int TokenBalance { get; set; } = 5;
}

class Tool
{
    public int Id { get; set; }
    public int OwnerId { get; set; }                  // foreign key to Users.Id
    public string Name { get; set; } = "";
    public string Category { get; set; } = "Hand Tools";
    public string Description { get; set; } = "";
    public string Condition { get; set; } = "Good";
    public string Status { get; set; } = "available";
    public int TokenCost { get; set; } = 1;
}

class Borrowing
{
    public int Id { get; set; }
    public int ToolId { get; set; }
    public int BorrowerId { get; set; }
    public int LenderId { get; set; }
    public int TokensSpent { get; set; } = 1;
    public string Status { get; set; } = "pending";   // pending | active | returned | declined
    public DateTime? AcceptedAt { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? ReturnedAt { get; set; }
}

// Request/response shapes (records are immutable data types)
record RegisterInput(string FullName, string Email, string Password, string? Role);
record LoginInput(string Email, string Password);
record UpdateMeInput(string? FullName, string? Password);
record ToolInput(string Name, string? Category, string? Description, string? Condition, int TokenCost = 1);
record UserDto(int Id, string FullName, string Email, string Role, int TokenBalance)
{
    public static UserDto From(User u) => new(u.Id, u.FullName, u.Email, u.Role, u.TokenBalance);
}
=======
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
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
