#!/bin/bash
# StudyMate AI - EC2 Setup Script
# Run this script on your EC2 instance after uploading your code

echo "🚀 Setting up StudyMate AI on EC2..."

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Python and dependencies
echo "🐍 Installing Python and pip..."
sudo apt install python3-pip python3-venv -y

# Install nginx
echo "🌐 Installing Nginx..."
sudo apt install nginx -y

# Create virtual environment
echo "🔧 Creating virtual environment..."
cd ~/studymate
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install Python packages
echo "📚 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env file with your actual credentials:"
    echo "    nano .env"
fi

# Create systemd service file
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/studymate.service > /dev/null <<EOF
[Unit]
Description=StudyMate AI Flask Application
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/studymate
Environment="PATH=/home/ubuntu/studymate/venv/bin"
ExecStart=/home/ubuntu/studymate/venv/bin/gunicorn --workers 3 --bind 0.0.0.0:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
echo "🔧 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/studymate > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 50M;
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/studymate /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Reload systemd and start services
echo "🚀 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable studymate
sudo systemctl start studymate
sudo systemctl restart nginx

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit your .env file: nano .env"
echo "2. Add your AWS Cognito, S3, and Gemini credentials"
echo "3. Restart the service: sudo systemctl restart studymate"
echo "4. Check status: sudo systemctl status studymate"
echo "5. View logs: sudo journalctl -u studymate -f"
echo ""
echo "🌐 Your app should be accessible at: http://$(curl -s ifconfig.me)"
echo ""
echo "🔒 Security reminders:"
echo "- Update Cognito callback URLs with your EC2 IP"
echo "- Configure EC2 security groups to allow ports 80, 443, and 5000"
echo "- Consider setting up HTTPS with Let's Encrypt"
echo ""