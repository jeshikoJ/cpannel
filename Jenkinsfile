pipeline {
  agent any
  stages {
    stage('Build image') {
      steps { sh 'docker build -t cpannel:latest .' }
    }
    stage('Deploy') {
      steps {
        sh '''
          docker rm -f cpannel || true
          docker run -d --name cpannel --restart unless-stopped \
            -p 127.0.0.1:3000:3000 \
            -v cpannel_data:/app/storage \
            cpannel:latest
        '''
      }
    }
  }
}
