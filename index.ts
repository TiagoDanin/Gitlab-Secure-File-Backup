#!/usr/bin/env tsx

import minimist from 'minimist';
import fs from 'fs-extra';
import axios, { AxiosRequestConfig } from 'axios';
import * as path from 'path';

const argv = minimist(process.argv.slice(2));

const showHelp = () => {
  console.log(`
  Usage
    $ yarn start

  Options
    --token        Gitlab Token Access
    --from         Repository name to download files
    --to           Repository name to upload files

  Examples
    $ yarn start --token="12345" --from="tiagodanin/api-v1" --to="tiagodanin/backend"
`)
}

const gitlab_token: string = argv?.token || ''
const repo_from: string = argv?.from || ''
const repo_to: string = argv?.to || ''

const backupDir = './backup';
const axiosConfig: AxiosRequestConfig = {
  maxBodyLength: Infinity,
  baseURL: 'https://gitlab.com/api/v4/',
  url: 'https://gitlab.com/api/v4/projects/idopterlabs%2Fwowlet%2Fwow-corporativo/secure_files',
  headers: { 
    'PRIVATE-TOKEN': gitlab_token,
    'Content-Type': 'multipart/form-data'
  }
};

const main = async () => {

  if (!fs.existsSync(backupDir)){
    fs.mkdirSync(backupDir);
  }

  const secureFilesList = await axios({
    ...axiosConfig,
    method: 'GET',
    url: `/projects/${encodeURIComponent(repo_from)}/secure_files`
  })

  console.log(`Get lists of files (${secureFilesList.data.length})`);

  for (const secureFile of secureFilesList.data) {
    const filePath = path.join( backupDir, `${secureFile.id}`);
    const fileWriter = fs.createWriteStream(filePath);

    const response  = await axios({
      ...axiosConfig,
      method: 'GET',
      responseType: 'stream',
      url: `/projects/${encodeURIComponent(repo_from)}/secure_files/${secureFile.id}/download`
    })

    const stream = response.data;
    stream.pipe(fileWriter);

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    console.log(`Download file ${secureFile.name} (${secureFile.id}) of ${repo_from}`)

    await axios({
      ...axiosConfig,
      method: 'POST',
      url: `/projects/${encodeURIComponent(repo_to)}/secure_files`,
      headers: {
        ...axiosConfig.headers,
        'Content-Type': 'multipart/form-data',
      },
      data: {
        name: secureFile.name,
        file: fs.createReadStream(filePath),
      },
    })

    console.log(`Upload file ${secureFile.name} (${secureFile.id}) in ${repo_to}`)
  }

  console.log('Done!')
}


if (gitlab_token && repo_from && repo_to) {
  main();
} else {
  showHelp();
}

