#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# 🎯 WebGIS Full-Stack Web Application Setup Script
# Combines Django backend with PostgreSQL/PostGIS and React frontend setup

echo "🚀 Starting WebGIS Full-Stack Application Setup..."

# ────────────────────────── ERROR HANDLING ──────────────────────────
# Add error handling function
handle_error() {
    local exit_code=$?
    local line_number=$1
    echo "❌ Error occurred in script at line $line_number (exit code: $exit_code)"
    echo "🧹 Cleaning up..."
    cleanup_on_error
    exit $exit_code
}

# Set up error trap
trap 'handle_error $LINENO' ERR

# Cleanup function for when things go wrong
cleanup_on_error() {
    echo "Performing cleanup operations..."
    # Kill any background processes if needed
    # Remove partial installations
    # Restore original state if possible
}

# Safe directory change function
safe_cd() {
    local target_dir="$1"
    if [[ ! -d "$target_dir" ]]; then
        echo "❌ Directory does not exist: $target_dir"
        return 1
    fi
    cd "$target_dir" || {
        echo "❌ Failed to change to directory: $target_dir"
        return 1
    }
    echo "📁 Changed to directory: $(pwd)"
}

# Function to run commands with better error reporting
run_command() {
    local description="$1"
    shift
    echo "🔄 $description..."
    if "$@"; then
        echo "✅ $description completed successfully"
    else
        local exit_code=$?
        echo "❌ $description failed (exit code: $exit_code)"
        echo "Command: $*"
        return $exit_code
    fi
}

# ────────────────────────── OS DETECTION ──────────────────────────
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        echo "🐧 Detected Linux operating system"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        echo "🍎 Detected macOS operating system"
    else
        echo "❌ Unsupported operating system: $OSTYPE"
        echo "This script supports Linux and macOS only"
        echo ""
        echo "💡 Windows users: Please use Windows Subsystem for Linux (WSL)"
        echo "   1. Install WSL: https://docs.microsoft.com/en-us/windows/wsl/install"
        echo "   2. Install Ubuntu or another Linux distribution"
        echo "   3. Run this script from within your WSL environment"
        exit 1
    fi
}

# ────────────────────────── CONFIGURATION ──────────────────────────
# This script provisions a *host* (non-container) Postgres/PostGIS + venv setup.
# For most users `docker compose up --build` from the repo root is simpler and is
# the recommended path; use this only when you want a native local install.
#
# Every value below can be overridden via environment variables, e.g.:
#   DB_PASS=secret DJANGO_SUPERPASS=secret ./backend/scripts/bootstrap.sh
# The defaults match backend/.env.example and are for LOCAL DEV ONLY; never ship
# them to production.

# Database configuration
PG_VER="${PG_VER:-16}"                 # PostgreSQL major version to install (PostGIS 3)
DB_NAME="${DB_NAME:-webgisdb}"
DB_USER="${DB_USER:-webgis}"
DB_PASS="${DB_PASS:-webgis}"

# Django superuser (created non-interactively)
DJANGO_SUPERUSER="${DJANGO_SUPERUSER:-admin}"
DJANGO_SUPERPASS="${DJANGO_SUPERPASS:-adminpass}"
DJANGO_SUPEREMAIL="${DJANGO_SUPEREMAIL:-admin@example.com}"
PYTHON_VENV=".venv"

# Monorepo subdirectories (this is one repo; run this script from the repo root).
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"

# Development URLs (frontend is root-served now that Vite base is '/')
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:8000"

# ────────────────────────── REQUIRED SOFTWARE CHECK ──────────────────────────
check_required_tools() {
    local REQUIRED_TOOLS=("node" "npm" "git" "python3" "psql" "gdal-config")

    # Add sudo to required tools only for Linux
    if [[ "$OS" == "linux" ]]; then
        REQUIRED_TOOLS+=("sudo")
    fi

    echo "🔍 Checking for required tools..."
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo "❌ Error: '$tool' is not installed. Please install it before running this script."
            exit 1
        fi
    done
    echo "✅ All required tools are installed."
}

# ────────────────────────── DEPLOYMENT CONFIG ──────────────────────────
# Deployment is handled by committed, version-controlled config rather than a
# generated file:
#   • docker-compose.yml (repo root) for the local containerized stack
#   • .do/app.yaml for DigitalOcean App Platform
# See the README "Deployment" section for details.
print_deployment_info() {
    echo "📦 Deployment config is committed to the repo:"
    echo "   • docker-compose.yml  - local containerized stack (db + backend + frontend)"
    echo "   • .do/app.yaml        - DigitalOcean App Platform spec"
    echo "   Validate the App Platform spec with: doctl apps spec validate .do/app.yaml"
}

# ────────────────────────── SYSTEM DEPENDENCIES ──────────────────────────
install_system_dependencies() {
    echo "🔧 Installing system dependencies..."

    if [[ "$OS" == "linux" ]]; then
        install_linux_dependencies
    elif [[ "$OS" == "macos" ]]; then
        install_macos_dependencies
    else
        echo "❌ Unsupported OS: $OS"
        return 1
    fi

    # Verify GDAL installation regardless of OS
    run_command "Verifying GDAL install" gdalinfo --version
}

install_linux_dependencies() {
    echo "🐧 Installing Linux dependencies..."

    # Update package list
    run_command "Updating package list" sudo apt update

    # Install PostgreSQL, PostGIS, and build tools
    run_command "Installing PostgreSQL + PostGIS + build tools" sudo apt install -y \
        "postgresql-$PG_VER" \
        "postgresql-$PG_VER-postgis-3" \
        python3-venv \
        python3-pip \
        python3-dev \
        build-essential \
        libpq-dev

    # Install geospatial libraries required by GDAL, GeoDjango, and friends
    run_command "Installing GDAL and geospatial libraries" sudo apt install -y \
        gdal-bin \
        libgdal-dev \
        libgeos-dev \
        libproj-dev \
        libspatialindex-dev \
        binutils
}

install_macos_dependencies() {
    echo "🍎 Installing macOS dependencies..."

    # Check if Homebrew is installed
    if ! command -v brew >/dev/null 2>&1; then
        echo "❌ Homebrew is not installed. Please install it first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        return 1
    fi

    # Update Homebrew
    run_command "Updating Homebrew" brew update

    # Install PostgreSQL and PostGIS
    run_command "Installing PostgreSQL" brew install postgresql@"$PG_VER"
    run_command "Installing PostGIS" brew install postgis

    # Install Python build dependencies
    run_command "Installing Python build tools" brew install python

    # Install geospatial libraries
    run_command "Installing GDAL and geospatial libraries" brew install \
        gdal \
        geos \
        proj \
        spatialindex

    # Start PostgreSQL service
    run_command "Starting PostgreSQL service" brew services start postgresql@"$PG_VER"
}

# ────────────────────────── POSTGRESQL & POSTGIS SETUP ──────────────────────────
check_postgresql_service() {
    echo "🔍 Checking PostgreSQL service..."

    if [[ "$OS" == "linux" ]]; then
        if ! sudo systemctl is-active --quiet postgresql; then
            echo "⚠️ PostgreSQL is not running. Starting it..."
            run_command "Starting PostgreSQL" sudo systemctl start postgresql
        fi
    elif [[ "$OS" == "macos" ]]; then
        # On macOS with Homebrew, PostgreSQL might already be started during installation
        # Check if it's running and start if needed
        if ! pgrep -f "postgres" >/dev/null 2>&1; then
            echo "⚠️ PostgreSQL is not running. Starting it..."
            run_command "Starting PostgreSQL" brew services start postgresql@"$PG_VER"
        fi
    fi
    echo "✅ PostgreSQL is running"
}

get_postgres_user() {
    if [[ "$OS" == "linux" ]]; then
        echo "postgres"
    elif [[ "$OS" == "macos" ]]; then
        whoami  # On macOS, use current user
    fi
}

setup_postgresql() {
    echo "🛠️ Setting up PostgreSQL..."

    check_postgresql_service

    local POSTGRES_USER
    POSTGRES_USER=$(get_postgres_user)

    # Test PostgreSQL connection
    if [[ "$OS" == "linux" ]]; then
        if ! sudo -u "$POSTGRES_USER" psql -c "SELECT version();" >/dev/null 2>&1; then
            echo "❌ Cannot connect to PostgreSQL"
            return 1
        fi
    elif [[ "$OS" == "macos" ]]; then
        if ! psql -d postgres -c "SELECT version();" >/dev/null 2>&1; then
            echo "❌ Cannot connect to PostgreSQL"
            return 1
        fi
    fi

    echo "🔄 Creating PostgreSQL user and database..."

    local ORIGINAL_DIR
    ORIGINAL_DIR=$(pwd)  # Set this before anything else
    cd /tmp || return 1

    if [[ "$OS" == "linux" ]]; then
        if ! sudo -u "$POSTGRES_USER" psql <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}'
   ) THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
      RAISE NOTICE 'User ${DB_USER} created successfully';
   ELSE
      RAISE NOTICE 'User ${DB_USER} already exists';
   END IF;
END
\$\$;

DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF
        then
            echo "❌ Failed to create PostgreSQL user/database"
            cd "$ORIGINAL_DIR"
            return 1
        fi

        # PostGIS extension
        if ! sudo -u "$POSTGRES_USER" psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS postgis;" ; then
            echo "❌ Failed to add PostGIS extension"
            cd "$ORIGINAL_DIR"
            return 1
        fi
    elif [[ "$OS" == "macos" ]]; then
        if ! psql -d postgres <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}'
   ) THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
      RAISE NOTICE 'User ${DB_USER} created successfully';
   ELSE
      RAISE NOTICE 'User ${DB_USER} already exists';
   END IF;
END
\$\$;

DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF
        then
            echo "❌ Failed to create PostgreSQL user/database"
            cd "$ORIGINAL_DIR"
            return 1
        fi

        # PostGIS extension
        if ! psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS postgis;" ; then
            echo "❌ Failed to add PostGIS extension"
            cd "$ORIGINAL_DIR"
            return 1
        fi
    fi

    cd "$ORIGINAL_DIR" || return 1
    echo "✅ PostgreSQL user and database created with PostGIS extension."
}

# ────────────────────────── REPOSITORY MANAGEMENT ──────────────────────────
validate_git_repo() {
    local repo_url="$1"
    local repo_name="$2"

    echo "🔍 Validating $repo_name repository..."
    if ! git ls-remote "$repo_url" HEAD >/dev/null 2>&1; then
        echo "❌ Cannot access repository: $repo_url"
        echo "Please check the URL and your internet connection"
        return 1
    fi
    echo "✅ Repository is accessible: $repo_url"
}

safe_clone_repo() {
    local repo_url="$1"
    local target_dir="$2"
    local repo_name="$3"

    validate_git_repo "$repo_url" "$repo_name"

    if [[ -d "$target_dir/.git" ]]; then
        echo "📁 $repo_name repository already exists, pulling latest changes..."
        safe_cd "$target_dir"
        run_command "Pulling latest changes" git pull
        cd .. || return 1
    else
        if [[ -d "$target_dir" ]]; then
            echo "⚠️ Directory exists but is not a git repository: $target_dir"
            echo "Please remove it manually and run the script again"
            return 1
        fi
        run_command "Cloning $repo_name repository" git clone "$repo_url" "$target_dir"
    fi
}

verify_monorepo() {
    # This project is a single monorepo: backend/, frontend/, and mobile/ are
    # already co-located, so there is nothing to clone. Just sanity-check them.
    echo "📁 Verifying monorepo layout..."
    for d in "$BACKEND_DIR" "$FRONTEND_DIR"; do
        if [[ ! -d "$d" ]]; then
            echo "❌ Expected directory '$d' not found. Run this script from the repo root."
            return 1
        fi
    done
    echo "✅ Monorepo layout looks good."
}

# ────────────────────────── FRONTEND SETUP (React + Vite) ──────────────────────────
setup_frontend() {
    echo "⚛️ Setting up React (Vite) frontend..."

    safe_cd "$FRONTEND_DIR"

    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        echo "❌ package.json not found in frontend directory"
        return 1
    fi

    # Install dependencies with error handling
    run_command "Installing frontend dependencies" npm install

    echo "✅ Frontend setup completed."
    cd .. || return 1
}

# ────────────────────────── BACKEND SETUP (Django) ──────────────────────────
create_backend_env() {
    echo "📝 Creating backend .env file..."

    # Create .env file or copy from parent directory
    if [[ -f "../.env" ]]; then
        cp ../.env .
        echo "✅ Copied .env file to backend directory."
    else
        # Create .env file directly in backend directory
        cat > .env <<EOF
# Django settings
DEBUG=True
SECRET_KEY=$(openssl rand -hex 32)
CORS_ALLOWED_ORIGINS=$FRONTEND_URL

# Database settings (matching POSTGRES_* variables in settings.py)
POSTGRES_ENGINE=django.contrib.gis.db.backends.postgis
POSTGRES_DB=$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Email settings
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=

# Development URLs
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$BACKEND_URL

EOF


        echo "✅ Created .env file in backend directory."
    fi
}

setup_django_superuser() {
    local venv_python="$1"

    echo "👤 Creating Django superuser..."
    if ! DJANGO_SETTINGS_MODULE="WebGIS.settings" "$venv_python" manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$DJANGO_SUPERUSER').exists():
    User.objects.create_superuser(username='$DJANGO_SUPERUSER', email='$DJANGO_SUPEREMAIL', password='$DJANGO_SUPERPASS')
    print("Superuser created successfully.")
else:
    print("Superuser already exists.")
EOF
    then
        echo "❌ Failed to create Django superuser"
        return 1
    fi
}

setup_backend() {
    echo "🐍 Setting up Django backend..."

    safe_cd "$BACKEND_DIR"

    # Check if requirements.txt exists
    if [[ ! -f "requirements.txt" ]]; then
        echo "❌ requirements.txt not found in backend directory"
        return 1
    fi

    # Set up virtual environment with error handling
    local VENV_PYTHON="$PYTHON_VENV/bin/python"
    local VENV_PIP="$PYTHON_VENV/bin/pip"


    if [[ ! -f "$VENV_PYTHON" ]]; then
        run_command "Creating Python virtual environment" python3 -m venv "$PYTHON_VENV"
    else
        echo "Virtual environment already exists at $PYTHON_VENV"
    fi

    # Verify virtual environment creation
    if [[ ! -f "$VENV_PYTHON" ]]; then
        echo "❌ Failed to create virtual environment"
        return 1
    fi

    # Verify gdal-config is available
    if ! command -v gdal-config >/dev/null 2>&1; then
        echo "❌ gdal-config not found. GDAL must be installed system-wide before proceeding."
        return 1
    fi

    # Cache and validate GDAL version
    echo "🔍 Fetching GDAL version..."
    GDAL_VERSION=$(gdal-config --version || echo "")
    if [[ -z "$GDAL_VERSION" || ! "$GDAL_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "❌ Failed to fetch or validate GDAL version. Ensure gdal-config is correctly installed and configured."
        return 1
    fi
    echo "✅ GDAL version: $GDAL_VERSION"

    # Install Python dependencies
    echo "📦 Installing Python dependencies..."
    run_command "Upgrading pip" "$VENV_PIP" install --upgrade pip
    run_command "Installing python-dotenv" "$VENV_PIP" install python-dotenv

    # Install modern PostgreSQL adapter first
    echo "🐘 Installing modern PostgreSQL adapter..."

    # Install other dependencies from requirements.txt, excluding GDAL to avoid conflicts
    echo "📦 Installing requirements (excluding GDAL)..."
    if ! grep -v -E "^GDAL==" requirements.txt | "$VENV_PIP" install -r /dev/stdin; then
        echo "⚠️ Some packages failed to install, trying individual installation..."
        # Fallback: install requirements.txt but skip problematic packages
        while read -r line; do
            if [[ ! "$line" =~ ^(GDAL) && ! "$line" =~ ^# && -n "$line" ]]; then
                "$VENV_PIP" install "$line" || echo "⚠️ Failed to install $line, continuing..."
            fi
        done < requirements.txt
    fi

    # Install the correct GDAL version for this system
    echo "🗺️ Installing GDAL Python binding for version $GDAL_VERSION..."
    run_command "Installing GDAL Python binding" "$VENV_PIP" install "GDAL==$GDAL_VERSION"

    # Create backend environment file
    create_backend_env

    # Create necessary directories
    run_command "Creating project directories" mkdir -p logs static media

    # Add GDAL/GEOS library paths to settings.py for macOS BEFORE running migrations
    if [[ "$OS" == "macos" ]]; then
        echo "🔧 Adding GDAL/GEOS library paths to Django settings.py for macOS..."

        # Check if the library paths are already in settings.py
        if ! grep -q "GDAL_LIBRARY_PATH.*os.getenv" WebGIS/settings.py 2>/dev/null; then
            # Add the import for platform if not already present
            if ! grep -q "import platform" WebGIS/settings.py; then
                sed -i.bak '/import os/a\
import platform\
' WebGIS/settings.py

 # Remove the backup file created by sed
                rm -f WebGIS/settings.py.bak

            fi

            # Add the GDAL/GEOS configuration after the imports using a here document
            cat >> WebGIS/settings.py << 'EOF'

# GDAL/GEOS library paths for macOS
GDAL_LIBRARY_PATH = os.getenv("GDAL_LIBRARY_PATH", f"{os.popen('brew --prefix').read().strip()}/opt/gdal/lib/libgdal.dylib")
GEOS_LIBRARY_PATH = os.getenv("GEOS_LIBRARY_PATH", f"{os.popen('brew --prefix').read().strip()}/opt/geos/lib/libgeos_c.dylib")
EOF

            echo "✅ Added GDAL/GEOS library paths to Django settings.py"
        else
            echo "✅ GDAL/GEOS library paths already configured in settings.py"
        fi
    fi

    # Set Django settings module for all operations
    export DJANGO_SETTINGS_MODULE="WebGIS.settings"

    # Apply Django migrations
    echo "⚙️ Applying Django migrations..."
    run_command "Running Django migrations" "$VENV_PYTHON" manage.py migrate

    # Create Django superuser
    setup_django_superuser "$VENV_PYTHON"

    # Collect static files
    echo "🧹 Collecting static files..."
    run_command "Collecting static files" "$VENV_PYTHON" manage.py collectstatic --noinput

    echo "✅ Backend setup completed."
    cd .. || return 1
}

# ────────────────────────── FINAL INSTRUCTIONS ──────────────────────────
display_final_instructions() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "────────────────────── NEXT STEPS ──────────────────────"
    echo ""
    echo "To start the development servers:"
    echo ""
    echo "1. 🚀 Start Frontend (React + Vite):"
    echo "   cd $FRONTEND_DIR"
    echo "   npm run dev"
    echo "   → Frontend will be available at: $FRONTEND_URL"
    echo ""
    echo "2. 🐍 Start Backend (Django):"
    echo "   cd $BACKEND_DIR"
    echo "   $PYTHON_VENV/bin/python manage.py runserver"
    echo "   → Backend will be available at: $BACKEND_URL"
    echo "   → Admin panel: $BACKEND_URL/admin"
    echo ""
    echo "   💡 Or activate the virtual environment manually:"
    echo "   source $PYTHON_VENV/bin/activate"
    echo "   python manage.py runserver"
    echo ""
    echo "────────────────────── CREDENTIALS ──────────────────────"
    echo "🔐 Django Admin:"
    echo "   Username: $DJANGO_SUPERUSER"
    echo "   Password: $DJANGO_SUPERPASS"
    echo "   Email: $DJANGO_SUPEREMAIL"
    echo ""
    echo "🗄️ Database:"
    echo "   Name: $DB_NAME"
    echo "   User: $DB_USER"
    echo "   Password: $DB_PASS"
    echo ""
    echo "────────────────────── DEPLOYMENT ──────────────────────"
    echo "📤 For deployment (DigitalOcean App Platform):"
    echo "1. Update the github repo/branch values in .do/app.yaml"
    echo "2. Push your code to those repositories"
    echo "3. Validate and create the app:"
    echo "     doctl apps spec validate .do/app.yaml"
    echo "     doctl apps create --spec .do/app.yaml"
    echo ""
    echo "🐳 For a local containerized stack: docker compose up --build"
    echo ""
    echo "🔧 Configuration files:"
    echo "   • .env (Django backend configuration)"
    echo "   • docker-compose.yml (local container stack)"
    echo "   • .do/app.yaml (DigitalOcean App Platform spec)"
    echo ""
    echo "✨ Happy coding!"
}

# ────────────────────────── MAIN EXECUTION ──────────────────────────
main() {
    echo "🎯 Full-Stack Web Application Setup Script"
    echo "Combines Django backend with PostgreSQL/PostGIS and React frontend setup"
    echo ""

    detect_os
    check_required_tools
    print_deployment_info
    install_system_dependencies
    setup_postgresql
    verify_monorepo
    setup_frontend
    setup_backend
    display_final_instructions
}

# Run the main function
main "$@"