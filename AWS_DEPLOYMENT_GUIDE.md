# StudyMate AI - AWS Deployment Guide

## Overview
This guide will help you deploy StudyMate AI on AWS using:
- **AWS EC2** (t2.micro - Free Tier) for hosting the Flask application
- **AWS Cognito** for user authentication and management
- **AWS S3** for file storage (already implemented)

---

## Part 1: AWS Cognito Setup

### Step 1: Create Cognito User Pool

1. **Go to AWS Console** → Search for "Cognito" → Click "Manage User Pools"

2. **Create a User Pool**
   - Click "Create user pool"
   - Pool name: `studymate-users`
   - Step through configuration:

3. **Configure Sign-in Experience**
   - Sign-in options: ✅ Email
   - User name requirements: Allow email addresses
   - Password policy: Cognito defaults (or customize as needed)

4. **Configure Security Requirements**
   - MFA: Optional (recommended: OFF for development, ON for production)
   - Account recovery: Email only

5. **Configure Sign-up Experience**
   - ✅ Enable self-registration
   - Attributes:
     - Required: email
     - Optional: name (if needed)

6. **Configure Message Delivery**
   - Email provider: Send email with Cognito (for development)
   - For production: Configure SES

7. **Integrate Your App**
   - User pool name: `studymate-users`
   - App type: Public client
   - App client name: `studymate-web-client`
   - ✅ Don't generate a client secret
   - Callback URLs: 
     - `http://localhost:5000/callback` (for testing)
     - `http://YOUR-EC2-IP:5000/callback` (add after EC2 setup)
   - Sign-out URLs:
     - `http://localhost:5000/signout` (for testing)
     - `http://YOUR-EC2-IP:5000/signout` (add after EC2 setup)

8. **Review and Create**
   - Review all settings
   - Click "Create user pool"

9. **Save These Values** (you'll need them):
   ```
   User Pool ID: us-east-1_XXXXXXXXX
   App Client ID: xxxxxxxxxxxxxxxxxxxx
   Region: us-east-1 (or your selected region)
   ```

---

## Part 2: AWS EC2 Setup

### Step 1: Launch EC2 Instance

1. **Go to EC2 Dashboard** → Click "Launch Instance"

2. **Configure Instance:**
   - Name: `studymate-server`
   - AMI: **Ubuntu Server 22.04 LTS** (Free tier eligible)
   - Instance type: **t2.micro** (Free tier)
   - Key pair: Create new key pair
     - Name: `studymate-key`
     - Type: RSA
     - Format: .pem (for Mac/Linux) or .ppk (for Windows/PuTTY)
     - **Download and save the key file securely**

3. **Network Settings:**
   - Create security group: `studymate-sg`
   - Allow:
     - ✅ SSH (port 22) - From your IP
     - ✅ HTTP (port 80) - From anywhere
     - ✅ HTTPS (port 443) - From anywhere
     - ✅ Custom TCP (port 5000) - From anywhere (for Flask)

4. **Configure Storage:**
   - Size: 8 GB (Free tier allows up to 30 GB)
   - Type: gp3

5. **Click "Launch Instance"**

### Step 2: Connect to EC2 Instance

**For Mac/Linux:**
```bash
# Set permissions on your key file
chmod 400 studymate-key.pem

# Connect to EC2
ssh -i "studymate-key.pem" ubuntu@YOUR-EC2-PUBLIC-IP
```

**For Windows (using PuTTY):**
- Convert .pem to .ppk using PuTTYgen
- Open PuTTY, enter EC2 public IP
- Under SSH → Auth → Browse for .ppk file
- Click "Open"

### Step 3: Install Dependencies on EC2

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Python and pip
sudo apt install python3-pip python3-venv -y

# Install nginx (optional, for production)
sudo apt install nginx -y

# Install git
sudo apt install git -y

# Create application directory
mkdir ~/studymate
cd ~/studymate
```

---

## Part 3: Deploy Application Code

### Step 1: Transfer Files to EC2

**Option A: Using SCP (Mac/Linux)**
```bash
# From your local machine
scp -i "studymate-key.pem" -r /path/to/your/project/* ubuntu@YOUR-EC2-IP:~/studymate/
```

**Option B: Using Git**
```bash
# On EC2 instance
cd ~/studymate
git clone YOUR-GITHUB-REPO-URL .
```

**Option C: Manual Upload**
- Use FileZilla or WinSCP to transfer files

### Step 2: Set Up Python Environment

```bash
# Create virtual environment
cd ~/studymate
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install requirements
pip install flask boto3 google-generativeai python-dotenv werkzeug PyPDF2 python-pptx python-docx reportlab warrant
```

### Step 3: Create Environment File

```bash
# Create .env file
nano .env
```

**Add the following content:**
```env
# Flask
SECRET_KEY=your-super-secret-key-change-this

# AWS S3
S3_BUCKET=your-s3-bucket-name
AWS_REGION=us-east-1

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
COGNITO_DOMAIN=studymate-auth
```

**Save:** Ctrl+O, Enter, Ctrl+X

---

## Part 4: Run Application

### Option A: Development Mode (Quick Test)

```bash
# Activate virtual environment
source venv/bin/activate

# Run Flask
python3 app.py
```

Access at: `http://YOUR-EC2-IP:5000`

### Option B: Production Mode (Recommended)

**1. Install Gunicorn:**
```bash
pip install gunicorn
```

**2. Create systemd service file:**
```bash
sudo nano /etc/systemd/system/studymate.service
```

**Add this content:**
```ini
[Unit]
Description=StudyMate AI Flask Application
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/studymate
Environment="PATH=/home/ubuntu/studymate/venv/bin"
ExecStart=/home/ubuntu/studymate/venv/bin/gunicorn --workers 3 --bind 0.0.0.0:5000 app:app

[Install]
WantedBy=multi-user.target
```

**3. Start the service:**
```bash
sudo systemctl daemon-reload
sudo systemctl start studymate
sudo systemctl enable studymate
sudo systemctl status studymate
```

**4. Configure Nginx (Optional, for better performance):**
```bash
sudo nano /etc/nginx/sites-available/studymate
```

**Add:**
```nginx
server {
    listen 80;
    server_name YOUR-EC2-IP;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/studymate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Part 5: Update Cognito Callback URLs

1. Go to AWS Cognito console
2. Select your user pool
3. Go to "App integration" → "App clients"
4. Edit your app client
5. Update Callback URLs:
   - Add: `http://YOUR-EC2-IP:5000/callback`
   - Add: `http://YOUR-EC2-IP/callback` (if using Nginx)
6. Update Sign-out URLs similarly
7. Save changes

---

## Part 6: Testing

1. **Access Application:**
   - With Flask directly: `http://YOUR-EC2-IP:5000`
   - With Nginx: `http://YOUR-EC2-IP`

2. **Test Sign Up:**
   - Create a new account
   - Verify email (check your inbox)
   - Sign in

3. **Test Features:**
   - Upload a document
   - Generate summary/quiz/notes/flashcards
   - Download outputs

---

## Troubleshooting

### Check Application Logs
```bash
# If using systemd service
sudo journalctl -u studymate -f

# If running directly
# Check console output
```

### Check Nginx Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### Common Issues

1. **Port 5000 not accessible:**
   - Check EC2 security group allows inbound port 5000
   - Check if application is running: `sudo netstat -tulpn | grep 5000`

2. **Cognito authentication fails:**
   - Verify callback URLs match exactly
   - Check COGNITO_* environment variables
   - Check user pool and app client IDs

3. **S3 upload fails:**
   - Verify EC2 instance has IAM role with S3 permissions
   - Or ensure AWS credentials are configured

4. **Database not persisting:**
   - Check file permissions: `ls -la studymate.db`
   - Ensure directory is writable

---

## Security Best Practices

1. **Never commit .env file to Git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use strong SECRET_KEY**
   ```python
   import secrets
   print(secrets.token_hex(32))
   ```

3. **Enable HTTPS (Production)**
   - Get free SSL certificate from Let's Encrypt
   - Configure Nginx with SSL

4. **Restrict SSH access**
   - Change EC2 security group SSH rule to "My IP" only

5. **Set up CloudWatch monitoring**
   - Monitor EC2 CPU/Memory usage
   - Set up alarms for high usage

---

## Cost Estimation (Free Tier)

- **EC2 t2.micro:** FREE for 750 hours/month (first 12 months)
- **S3:** FREE for 5GB storage, 20,000 GET requests, 2,000 PUT requests/month
- **Cognito:** FREE for 50,000 MAUs (Monthly Active Users)
- **Data Transfer:** 1GB/month free

**After Free Tier:**
- EC2 t2.micro: ~$8-10/month
- S3: ~$0.023/GB/month
- Cognito: Free up to 50K MAUs, then $0.0055/MAU

---

## Next Steps (Optional Enhancements)

1. **Domain Name:**
   - Register domain on Route 53
   - Point to EC2 instance
   - Enable HTTPS with Let's Encrypt

2. **Load Balancer:**
   - Add Application Load Balancer
   - Enable auto-scaling

3. **RDS Database:**
   - Replace SQLite with RDS PostgreSQL
   - Better for production

4. **CloudFront:**
   - Add CDN for static files
   - Improve global performance

5. **Backup Strategy:**
   - Automated S3 backups
   - Database snapshots

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review application logs
3. Verify all environment variables are set correctly
4. Ensure EC2 security groups allow required ports

---

**Deployment Checklist:**
- [ ] Cognito User Pool created
- [ ] EC2 instance launched
- [ ] Security groups configured
- [ ] Application code deployed
- [ ] Environment variables set
- [ ] Dependencies installed
- [ ] Application running
- [ ] Cognito callbacks updated
- [ ] Testing completed
- [ ] Production service configured

Good luck with your deployment! 🚀