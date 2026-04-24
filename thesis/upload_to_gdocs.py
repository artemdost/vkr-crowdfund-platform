"""Upload ВКР_полный.docx to Google Docs.

По умолчанию обновляет "последний" созданный документ (ID хранится в last_doc_id.txt).
Флаг --new создаёт новый документ и сохраняет его ID как последний.
"""

import os
import sys
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
BASE_DIR = os.path.dirname(__file__)
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
DOCX_FILE = os.path.join(BASE_DIR, "ВКР_полный.docx")
LAST_DOC_ID_FILE = os.path.join(BASE_DIR, "last_doc_id.txt")


def get_credentials():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())
    return creds


def save_last_doc_id(doc_id):
    with open(LAST_DOC_ID_FILE, "w") as f:
        f.write(doc_id)


def load_last_doc_id():
    if os.path.exists(LAST_DOC_ID_FILE):
        with open(LAST_DOC_ID_FILE) as f:
            return f.read().strip()
    return None


def upload_as_new_doc(creds):
    """Создать новый Google Doc и сохранить его ID как последний."""
    service = build("drive", "v3", credentials=creds)

    file_metadata = {
        "name": "ВКР - Платформа коллективного инвестирования",
        "mimeType": "application/vnd.google-apps.document",
    }
    media = MediaFileUpload(
        DOCX_FILE,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        resumable=True,
    )
    file = service.files().create(
        body=file_metadata, media_body=media, fields="id,webViewLink"
    ).execute()

    save_last_doc_id(file["id"])
    print(f"Created NEW doc! ID: {file['id']}")
    print(f"Link: {file['webViewLink']}")
    return file


def update_doc(creds, doc_id):
    """Обновить содержимое существующего Google Doc."""
    service = build("drive", "v3", credentials=creds)

    media = MediaFileUpload(
        DOCX_FILE,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        resumable=True,
    )
    file = service.files().update(
        fileId=doc_id, media_body=media, fields="id,webViewLink"
    ).execute()

    print(f"Updated existing doc! ID: {file['id']}")
    print(f"Link: {file['webViewLink']}")
    return file


if __name__ == "__main__":
    creds = get_credentials()

    if "--new" in sys.argv:
        upload_as_new_doc(creds)
    else:
        last_id = load_last_doc_id()
        if not last_id:
            print("Нет сохранённого last_doc_id.txt → создаю новый документ")
            upload_as_new_doc(creds)
        else:
            try:
                update_doc(creds, last_id)
            except Exception as e:
                print(f"Не удалось обновить {last_id}: {e}")
                print("Создаю новый...")
                upload_as_new_doc(creds)
