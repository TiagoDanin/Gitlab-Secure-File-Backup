#!/usr/bin/env tsx

import axios, { AxiosRequestConfig } from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';
import minimist from 'minimist';
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
    --download     Download files only (optional)

  Examples
    $ yarn start --token="12345" --from="tiagodanin/api-v1" --to="tiagodanin/backend"
    $ yarn start --token="12345" --from="tiagodanin/api-v1" --download
`);
};

const gitlab_token: string = argv?.token || '';
const repo_from: string = argv?.from || '';
const repo_to: string = argv?.to || '';
const download_only: boolean = argv?.download || false;

const backupDir = './backup';
const axiosConfig: AxiosRequestConfig = {
  timeout: 30000,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  baseURL: 'https://gitlab.com/api/v4/',
  headers: {
    'PRIVATE-TOKEN': gitlab_token,
  },
};

const main = async () => {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const secureFilesList = await axios({
    ...axiosConfig,
    method: 'GET',
    url: `/projects/${encodeURIComponent(repo_from)}/secure_files`,
  });

  console.log(`Get lists of files (${secureFilesList.data.length})`);

  for (const secureFile of secureFilesList.data) {
    const filePath = path.join(backupDir, secureFile.name);
    const fileDir = path.dirname(filePath);

    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    const fileWriter = fs.createWriteStream(filePath);

    const response = await axios({
      ...axiosConfig,
      method: 'GET',
      responseType: 'stream',
      url: `/projects/${encodeURIComponent(repo_from)}/secure_files/${secureFile.id}/download`,
    });

    const stream = response.data;
    stream.pipe(fileWriter);

    await new Promise<void>((resolve, reject) => {
      fileWriter.on('finish', () => resolve());
      fileWriter.on('error', () => reject());
    });

    console.log(`Download file ${secureFile.name} (${secureFile.id}) of ${repo_from}`);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      console.error(`Error: File ${filePath} is empty or does not exist.`);
      continue;
    }

    const newFilePath = `${filePath}`;
    fs.renameSync(filePath, newFilePath);

    if (download_only) {
      continue;
    } else if (!secureFile.name.match(/\.cer$|\.p12$/)) {
      console.log(`Skipping: ${secureFile.name}`);
      continue;
    }

    const formData = new FormData();
    formData.append('name', secureFile.name);
    formData.append('file', fs.createReadStream(newFilePath));

    try {
      await axios({
        ...axiosConfig,
        method: 'POST',
        url: `/projects/${encodeURIComponent(repo_to)}/secure_files`,
        headers: {
          ...axiosConfig.headers,
          ...formData.getHeaders(),
        },
        data: formData,
      });
      console.log(`Upload file ${secureFile.name} (${secureFile.id}) in ${repo_to}`);
    } catch (error) {
      console.error(`Error uploading file ${secureFile.name}:`, error.response?.data || error.message);
    }
  }

  console.log('Done!');
};

if (gitlab_token && repo_from && (repo_to || download_only)) {
  main();
} else {
  showHelp();
}
